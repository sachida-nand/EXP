import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { colors } from '../../constants/colors';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  ImportPaymentModal,
  type ImportSubmitPayload,
} from '../../components/modals/ImportPaymentModal';
import { recognizeText } from '../../services/ocr/textRecognition';
import { parseUpiText } from '../../services/ocr/upiParser';
import {
  listDrafts,
  newDraftId,
  persistScreenshot,
  removeDraft,
  saveDraft,
} from '../../services/storage/draftsStorage';
import { secureStorage } from '../../services/storage/secureStorage';
import {
  ensureReceiptsFolder,
  uploadReceiptImage,
} from '../../services/drive/driveReceipts';
import { useAuth } from '../../hooks/useAuth';
import { useDataContext } from '../../context/DataContext';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  monthName,
  toSheetDate,
  year as yearOf,
} from '../../utils/dateHelpers';
import type { ParsedPayment, PaymentDraft } from '../../types';

export default function ImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ uri?: string }>();
  const { user } = useAuth();
  const { allocations, addSpend, addFixedPayment } = useDataContext();

  const [drafts, setDrafts] = useState<PaymentDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [currency, setCurrency] = useState('₹');

  const [processing, setProcessing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeUri, setActiveUri] = useState('');
  const [activeParsed, setActiveParsed] = useState<ParsedPayment | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<'wallet' | 'fixed' | undefined>();
  const [activeBucketName, setActiveBucketName] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<PaymentDraft | null>(null);
  const handledIntentRef = useRef<string | null>(null);

  const refreshDrafts = useCallback(async () => {
    if (!user) return;
    setDraftsLoading(true);
    try {
      const list = await listDrafts(user.uid);
      setDrafts(list);
    } finally {
      setDraftsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void secureStorage.getCurrency(user.uid).then((c) => c && setCurrency(c));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshDrafts();
    }, [refreshDrafts]),
  );

  const runOcr = useCallback(
    async (uri: string) => {
      setProcessing(true);
      try {
        const text = await recognizeText(uri);
        console.log('[import] ocr raw text:\n', text);
        if (!text.trim()) {
          Alert.alert(
            'Could not read screenshot',
            'OCR returned no text. Try a clearer image.',
          );
          return;
        }
        const parsed = parseUpiText(text);
        console.log('[import] parsed:', JSON.stringify(parsed, null, 2));
        setActiveUri(uri);
        setActiveParsed(parsed);
        setActiveDraftId(null);
        setActiveTarget(undefined);
        setActiveBucketName(undefined);
        setModalVisible(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'OCR failed';
        Alert.alert('Could not read screenshot', msg);
      } finally {
        setProcessing(false);
      }
    },
    [],
  );

  // Handle share-intent / deep-link arrival via the `uri` query param.
  useEffect(() => {
    const incoming = typeof params.uri === 'string' ? params.uri : '';
    if (!incoming) return;
    if (handledIntentRef.current === incoming) return;
    handledIntentRef.current = incoming;
    // Clear the param so re-focus doesn't retrigger.
    router.setParams({ uri: undefined });
    void runOcr(incoming);
  }, [params.uri, router, runOcr]);


  const onPickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow access to your photos to import a screenshot.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await runOcr(result.assets[0].uri);
  };

  const openDraft = (draft: PaymentDraft) => {
    setActiveUri(draft.screenshotUri);
    setActiveParsed(draft.parsed);
    setActiveDraftId(draft.id);
    setActiveTarget(draft.target);
    setActiveBucketName(draft.bucketName);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalVisible(false);
    setActiveParsed(null);
    setActiveUri('');
    setActiveDraftId(null);
  };

  const onSaveDraft = async (payload: ImportSubmitPayload) => {
    if (!user || !activeParsed) return;
    setBusy(true);
    try {
      const persistedUri =
        activeDraftId && activeUri.includes('/drafts/')
          ? activeUri
          : await persistScreenshot(activeUri);
      const draft: PaymentDraft = {
        id: activeDraftId ?? newDraftId(),
        capturedAt: dayjs().toISOString(),
        screenshotUri: persistedUri,
        parsed: {
          ...activeParsed,
          amount: payload.amount,
          paidTo: payload.paidTo,
          message: payload.message,
          txnId: payload.txnId,
          date: payload.date,
        },
        target: payload.target,
        bucketName: payload.bucketName,
      };
      await saveDraft(user.uid, draft);
      await refreshDrafts();
      setModalVisible(false);
      setActiveParsed(null);
      setActiveUri('');
      setActiveDraftId(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save draft';
      Alert.alert('Save failed', msg);
    } finally {
      setBusy(false);
    }
  };

  const onSaveFinal = async (payload: ImportSubmitPayload) => {
    if (!user) return;
    setBusy(true);
    try {
      const m = monthName(payload.date);
      const y = yearOf(payload.date);
      const stamp = `${m}-${y}-import-${Date.now()}`;
      const safeStamp = stamp.replace(/[^\w.-]+/g, '_');

      const [compressed, folderId] = await Promise.all([
        ImageManipulator.manipulateAsync(
          activeUri,
          [{ resize: { width: 1080 } }],
          { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG },
        ),
        ensureReceiptsFolder(user.uid, user.name),
      ]);
      const receiptLink = await uploadReceiptImage(
        user.uid,
        folderId,
        compressed.uri,
        `${safeStamp}.jpg`,
        'image/jpeg',
      );

      if (payload.target === 'wallet') {
        await addSpend({
          date: toSheetDate(payload.date),
          month: m,
          year: y,
          amount: payload.amount,
          paidTo: payload.paidTo,
          notes: payload.message,
          receiptLink,
          deductsWallet: payload.deductsWallet,
        });
      } else {
        if (!payload.bucketName || !payload.bucketType) {
          throw new Error('Bucket missing');
        }
        await addFixedPayment({
          month: m,
          year: y,
          bucketName: payload.bucketName,
          paymentType: payload.bucketType === 'give' ? 'given' : 'paid',
          amount: payload.amount,
          paidTo: payload.paidTo,
          datePaid: toSheetDate(payload.date),
          receiptLink,
          notes: payload.message,
        });
      }

      if (activeDraftId) {
        await removeDraft(user.uid, activeDraftId);
      }
      await refreshDrafts();
      setModalVisible(false);
      setActiveParsed(null);
      setActiveUri('');
      setActiveDraftId(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not save the payment';
      Alert.alert('Save failed', msg);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = (draft: PaymentDraft) => {
    setPendingDelete(draft);
  };

  const runDelete = async () => {
    if (!user || !pendingDelete) return;
    try {
      await removeDraft(user.uid, pendingDelete.id);
      setPendingDelete(null);
      await refreshDrafts();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Could not delete draft';
      Alert.alert('Delete failed', msg);
    }
  };

  const draftsView = useMemo(() => {
    if (drafts.length === 0) {
      return (
        <Text style={styles.empty}>
          No drafts. Share a UPI payment screenshot to ExpenseManager, or pick
          one above.
        </Text>
      );
    }
    return drafts.map((d) => (
      <Pressable
        key={d.id}
        onPress={() => openDraft(d)}
        style={styles.draftRow}
      >
        <Image
          source={{ uri: d.screenshotUri }}
          style={styles.draftThumb}
          resizeMode="cover"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.draftAmount}>
            {formatCurrency(d.parsed.amount, currency)}
          </Text>
          <Text style={styles.draftMeta} numberOfLines={1}>
            {d.parsed.paidTo || 'Unknown recipient'}
          </Text>
          <Text style={styles.draftSub} numberOfLines={1}>
            {d.target === 'fixed'
              ? `Fixed · ${d.bucketName ?? '—'}`
              : 'Wallet'}{' '}
            · saved {dayjs(d.capturedAt).format('DD MMM HH:mm')}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            confirmDelete(d);
          }}
          hitSlop={10}
          style={styles.draftDelete}
        >
          <Ionicons name="trash-outline" size={18} color={colors.red} />
        </Pressable>
      </Pressable>
    ));
  }, [drafts, currency]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={draftsLoading}
            onRefresh={refreshDrafts}
          />
        }
      >
        <Text style={styles.title}>Import payment</Text>
        <Text style={styles.subtitle}>
          Pick a UPI screenshot or share one to ExpenseManager — we'll read the
          amount, recipient, and message and let you save it as a wallet spend
          or a fixed payment.
        </Text>

        <Pressable
          onPress={onPickImage}
          disabled={processing}
          style={[styles.pickBtn, processing && styles.pickBtnDisabled]}
        >
          {processing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name="image-outline" size={18} color={colors.white} />
          )}
          <Text style={styles.pickBtnText}>
            {processing ? 'Reading screenshot…' : 'Pick a screenshot'}
          </Text>
        </Pressable>

        <Text style={styles.section}>Drafts</Text>
        {draftsView}

        <View style={{ height: 40 }} />
      </ScrollView>

      {activeParsed && activeUri ? (
        <ImportPaymentModal
          visible={modalVisible}
          screenshotUri={activeUri}
          parsed={activeParsed}
          allocations={allocations}
          initialTarget={activeTarget}
          initialBucketName={activeBucketName}
          isDraft={activeDraftId !== null}
          busy={busy}
          onCancel={closeModal}
          onSaveDraft={onSaveDraft}
          onSave={onSaveFinal}
          currency={currency}
        />
      ) : null}

      <ConfirmDialog
        visible={pendingDelete !== null}
        title="Delete draft?"
        message={
          pendingDelete
            ? `${pendingDelete.parsed.paidTo || 'Draft'} · ${formatCurrency(
                pendingDelete.parsed.amount,
                currency,
              )}`
            : ''
        }
        confirmLabel="Delete"
        destructive
        icon="trash-outline"
        onCancel={() => setPendingDelete(null)}
        onConfirm={runDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  scroll: { padding: 16 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gray,
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.7,
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.blue,
  },
  pickBtnDisabled: { opacity: 0.6 },
  pickBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  section: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray,
    marginTop: 22,
    marginBottom: 8,
  },
  empty: {
    fontSize: 13,
    color: colors.gray,
    opacity: 0.6,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 14,
    lineHeight: 19,
  },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.grayLight,
    marginBottom: 8,
  },
  draftThumb: {
    width: 48,
    height: 60,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  draftAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray,
  },
  draftMeta: {
    fontSize: 12,
    color: colors.gray,
    marginTop: 2,
  },
  draftSub: {
    fontSize: 11,
    color: colors.gray,
    opacity: 0.6,
    marginTop: 2,
  },
  draftDelete: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
