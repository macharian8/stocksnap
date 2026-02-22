import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { pickFromCamera, pickFromLibrary } from '../../../lib/imageUtils';
import { analyzeImage } from '../../../lib/vision';
import { generateSku } from '../../../lib/sku';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/auth';
import { useToastStore } from '../../../store/toast';
import type { Item } from '../../../types';
import { decode } from 'base64-arraybuffer';

type Condition = Item['condition'];
type UnitOfMeasure = Item['unit_of_measure'];

const CONDITIONS: { label: string; value: Condition }[] = [
  { label: 'New', value: 'new' },
  { label: 'Used', value: 'used' },
  { label: 'Refurbished', value: 'refurbished' },
];

const UNITS: { label: string; value: UnitOfMeasure }[] = [
  { label: 'Piece', value: 'piece' },
  { label: 'Pair', value: 'pair' },
  { label: 'Kg', value: 'kg' },
  { label: 'Metre', value: 'metre' },
  { label: 'Litre', value: 'litre' },
  { label: 'Other', value: 'other' },
];

interface FormData {
  title: string;
  category: string;
  condition: Condition;
  unitOfMeasure: UnitOfMeasure;
  buyPrice: string;
  sellPrice: string;
  floorPrice: string;
  ceilingPrice: string;
  quantity: string;
  reorderPoint: string;
}

interface DuplicateMatch {
  id: string;
  title: string;
  sku: string;
  quantity_in_stock: number;
}

function PickerRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-[#111827]">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`min-h-[44px] items-center justify-center rounded-lg border px-4 py-2 ${
              value === opt.value
                ? 'border-[#2563EB] bg-[#DBEAFE]'
                : 'border-[#E5E7EB] bg-white'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                value === opt.value ? 'text-[#2563EB]' : 'text-[#6B7280]'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PriceInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-[#111827]">{label}</Text>
      <View
        className={`flex-row items-center rounded-xl border bg-white px-4 ${
          error ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
        }`}
      >
        <Text className="mr-2 text-sm text-[#6B7280]">KES</Text>
        <TextInput
          className="min-h-[48px] flex-1 text-base text-[#111827]"
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor="#9CA3AF"
          value={value}
          onChangeText={(t) => onChangeText(t.replace(/[^0-9.]/g, ''))}
        />
      </View>
      {error ? (
        <Text className="mt-1 text-xs text-[#DC2626]">{error}</Text>
      ) : null}
    </View>
  );
}

export default function AddItemScreen() {
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.show);

  // Image state
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form state
  const [form, setForm] = useState<FormData>({
    title: '',
    category: '',
    condition: 'new',
    unitOfMeasure: 'piece',
    buyPrice: '',
    sellPrice: '',
    floorPrice: '',
    ceilingPrice: '',
    quantity: '',
    reorderPoint: '3',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [showForm, setShowForm] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Duplicate detection state
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => {
        const next = { ...prev, [key]: value };
        // Auto-fill floor price when sell price changes and floor hasn't been manually set
        if (key === 'sellPrice' && prev.floorPrice === prev.sellPrice) {
          next.floorPrice = value as string;
        }
        return next;
      });
      setFormErrors((prev) => ({ ...prev, [key]: undefined }));
      setSaveError(null);
    },
    []
  );

  const handleCamera = useCallback(async () => {
    const result = await pickFromCamera();
    if (result) {
      setImageUri(result.uri);
      setImageBase64(result.base64);
    }
  }, []);

  const handleLibrary = useCallback(async () => {
    const result = await pickFromLibrary();
    if (result) {
      setImageUri(result.uri);
      setImageBase64(result.base64);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!imageBase64) {
      setShowForm(true);
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeImage(imageBase64);
      if (result) {
        setForm((prev) => ({
          ...prev,
          title: result.title || prev.title,
          category: result.category || prev.category,
        }));
      }
    } catch {
      // Vision API failed — proceed with empty fields
    }
    setIsAnalyzing(false);
    setShowForm(true);
  }, [imageBase64]);

  const handleSkipPhoto = useCallback(() => {
    setShowForm(true);
  }, []);

  // Validation
  const validate = useCallback((): boolean => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.buyPrice || parseFloat(form.buyPrice) <= 0)
      errors.buyPrice = 'Must be greater than 0';
    if (!form.sellPrice || parseFloat(form.sellPrice) <= 0)
      errors.sellPrice = 'Must be greater than 0';
    if (!form.quantity || parseInt(form.quantity, 10) <= 0)
      errors.quantity = 'Must be greater than 0';

    const sell = parseFloat(form.sellPrice || '0');
    const floor = parseFloat(form.floorPrice || '0');
    const ceiling = form.ceilingPrice ? parseFloat(form.ceilingPrice) : null;

    if (floor > sell) errors.floorPrice = 'Floor must be ≤ sell price';
    if (ceiling !== null && ceiling < sell)
      errors.ceilingPrice = 'Ceiling must be ≥ sell price';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form]);

  // Duplicate detection
  const checkDuplicates = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    const { data: existing } = await supabase
      .from('items')
      .select('id, title, sku, quantity_in_stock')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!existing || existing.length === 0) return false;

    const newTitle = form.title.trim().toLowerCase();
    const match = (existing as DuplicateMatch[]).find((item) => {
      const existingTitle = item.title.toLowerCase();
      return (
        existingTitle.includes(newTitle) || newTitle.includes(existingTitle)
      );
    });

    if (match) {
      setDuplicateMatch(match);
      setShowDuplicateModal(true);
      return true;
    }

    return false;
  }, [user, form.title]);

  // Add to existing stock
  const handleAddToExisting = useCallback(async () => {
    if (!duplicateMatch) return;

    setShowDuplicateModal(false);
    setIsSaving(true);

    const addQuantity = parseInt(form.quantity, 10) || 0;
    const { error } = await supabase
      .from('items')
      .update({
        quantity_in_stock: duplicateMatch.quantity_in_stock + addQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq('id', duplicateMatch.id);

    setIsSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    showToast(
      `Added ${addQuantity} to "${duplicateMatch.title}" stock`,
      'success'
    );
    router.back();
  }, [duplicateMatch, form.quantity, showToast]);

  // Save new item
  const saveItem = useCallback(async () => {
    if (!user) return;

    setIsSaving(true);
    setSaveError(null);

    const sku = generateSku(user.id);
    const qrCodeData = `stocksnap://item/${sku}`;
    let imageUrl: string | null = null;

    // Upload image if present
    if (imageBase64) {
      const filePath = `${user.id}/${sku}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(filePath, decode(imageBase64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        // Non-fatal: save item without image
        setSaveError(null);
      } else {
        const { data: urlData } = supabase.storage
          .from('item-images')
          .getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
      }
    }

    const now = new Date().toISOString();
    const itemData = {
      user_id: user.id,
      title: form.title.trim(),
      description: null,
      sku,
      category: form.category.trim() || null,
      condition: form.condition,
      unit_of_measure: form.unitOfMeasure,
      buy_price: parseFloat(form.buyPrice),
      sell_price: parseFloat(form.sellPrice),
      sell_price_floor: parseFloat(form.floorPrice || form.sellPrice),
      sell_price_ceiling: form.ceilingPrice
        ? parseFloat(form.ceilingPrice)
        : null,
      quantity_in_stock: parseInt(form.quantity, 10),
      quantity_sold: 0,
      reorder_point: parseInt(form.reorderPoint, 10) || 3,
      image_url: imageUrl,
      qr_code_data: qrCodeData,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    const { error: insertError } = await supabase
      .from('items')
      .insert(itemData);

    setIsSaving(false);

    if (insertError) {
      setSaveError(insertError.message);
      return;
    }

    showToast('Item added successfully', 'success');
    router.back();
  }, [user, imageBase64, form, showToast]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;

    const hasDuplicate = await checkDuplicates();
    if (hasDuplicate) return;

    await saveItem();
  }, [validate, checkDuplicates, saveItem]);

  const handleCreateNew = useCallback(() => {
    setShowDuplicateModal(false);
    saveItem();
  }, [saveItem]);

  // Photo capture step
  if (!showForm) {
    return (
      <>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Add Item',
            headerStyle: { backgroundColor: '#EFF6FF' },
            headerTintColor: '#2563EB',
            headerTitleStyle: { color: '#111827', fontWeight: '700' },
          }}
        />
        <View className="flex-1 bg-[#EFF6FF] px-6 pt-8">
          {imageUri ? (
            <View className="items-center">
              <Image
                source={{ uri: imageUri }}
                className="h-64 w-64 rounded-2xl"
                contentFit="cover"
              />
              <View className="mt-6 w-full flex-row gap-3">
                <Pressable
                  onPress={handleCamera}
                  className="min-h-[48px] flex-1 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
                >
                  <Text className="text-sm font-medium text-[#6B7280]">
                    Retake
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleAnalyze}
                  disabled={isAnalyzing}
                  className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-[#2563EB] disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">
                      {process.env.EXPO_PUBLIC_VISION_API_KEY
                        ? 'Analyze'
                        : 'Continue'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-6xl">📷</Text>
              <Text className="mt-6 text-lg font-semibold text-[#111827]">
                Take a photo of your item
              </Text>
              <Text className="mt-2 text-center text-sm text-[#6B7280]">
                We'll try to identify it automatically
              </Text>

              <View className="mt-10 w-full gap-3">
                <Pressable
                  onPress={handleCamera}
                  className="min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB]"
                >
                  <Text className="text-base font-semibold text-white">
                    Open Camera
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleLibrary}
                  className="min-h-[52px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
                >
                  <Text className="text-base font-medium text-[#6B7280]">
                    Pick from Library
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSkipPhoto}
                  className="mt-2 min-h-[44px] items-center justify-center"
                >
                  <Text className="text-sm font-medium text-[#2563EB]">
                    Skip photo
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </>
    );
  }

  // Details form step
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Item Details',
          headerStyle: { backgroundColor: '#EFF6FF' },
          headerTintColor: '#2563EB',
          headerTitleStyle: { color: '#111827', fontWeight: '700' },
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-[#EFF6FF]"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image preview */}
          {imageUri ? (
            <View className="mb-6 mt-4 items-center">
              <Image
                source={{ uri: imageUri }}
                className="h-32 w-32 rounded-xl"
                contentFit="cover"
              />
            </View>
          ) : null}

          {/* Title */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Title *
            </Text>
            <TextInput
              className={`min-h-[48px] rounded-xl border bg-white px-4 text-base text-[#111827] ${
                formErrors.title ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
              }`}
              placeholder="e.g. Blue Running Shoes"
              placeholderTextColor="#9CA3AF"
              value={form.title}
              onChangeText={(t) => updateField('title', t)}
              autoFocus
            />
            {formErrors.title ? (
              <Text className="mt-1 text-xs text-[#DC2626]">
                {formErrors.title}
              </Text>
            ) : null}
          </View>

          {/* Category */}
          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Category
            </Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#111827]"
              placeholder="e.g. Footwear"
              placeholderTextColor="#9CA3AF"
              value={form.category}
              onChangeText={(t) => updateField('category', t)}
            />
          </View>

          {/* Condition */}
          <PickerRow
            label="Condition"
            options={CONDITIONS}
            value={form.condition}
            onChange={(v) => updateField('condition', v)}
          />

          {/* Unit of measure */}
          <PickerRow
            label="Unit of measure"
            options={UNITS}
            value={form.unitOfMeasure}
            onChange={(v) => updateField('unitOfMeasure', v)}
          />

          {/* Pricing */}
          <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Pricing
          </Text>

          <PriceInput
            label="Cost Price *"
            value={form.buyPrice}
            onChangeText={(t) => updateField('buyPrice', t)}
            error={formErrors.buyPrice}
          />
          <PriceInput
            label="Default Sell Price *"
            value={form.sellPrice}
            onChangeText={(t) => updateField('sellPrice', t)}
            error={formErrors.sellPrice}
          />
          <PriceInput
            label="Floor Price"
            value={form.floorPrice}
            onChangeText={(t) => updateField('floorPrice', t)}
            placeholder="Same as sell price"
            error={formErrors.floorPrice}
          />
          <PriceInput
            label="Ceiling Price"
            value={form.ceilingPrice}
            onChangeText={(t) => updateField('ceilingPrice', t)}
            placeholder="Optional"
            error={formErrors.ceilingPrice}
          />

          {/* Stock */}
          <Text className="mb-3 mt-2 text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
            Stock
          </Text>

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Quantity *
            </Text>
            <TextInput
              className={`min-h-[48px] rounded-xl border bg-white px-4 text-base text-[#111827] ${
                formErrors.quantity ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
              }`}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              value={form.quantity}
              onChangeText={(t) =>
                updateField('quantity', t.replace(/\D/g, ''))
              }
            />
            {formErrors.quantity ? (
              <Text className="mt-1 text-xs text-[#DC2626]">
                {formErrors.quantity}
              </Text>
            ) : null}
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-sm font-medium text-[#111827]">
              Reorder alert at
            </Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-[#E5E7EB] bg-white px-4 text-base text-[#111827]"
              keyboardType="number-pad"
              placeholder="3"
              placeholderTextColor="#9CA3AF"
              value={form.reorderPoint}
              onChangeText={(t) =>
                updateField('reorderPoint', t.replace(/\D/g, ''))
              }
            />
          </View>

          {/* Save error */}
          {saveError ? (
            <View className="mb-4 rounded-lg bg-[#FEE2E2] px-3 py-2">
              <Text className="text-sm text-[#DC2626]">{saveError}</Text>
            </View>
          ) : null}

          {/* Save button */}
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            className="mb-8 min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB] disabled:opacity-50"
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-base font-semibold text-white">
                Save Item
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Duplicate detection modal */}
      <Modal
        visible={showDuplicateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white px-6 pb-10 pt-6">
            <Text className="mb-2 text-lg font-bold text-[#111827]">
              Similar item found
            </Text>
            <Text className="mb-4 text-sm text-[#6B7280]">
              "{duplicateMatch?.title}" ({duplicateMatch?.sku}) already exists
              with {duplicateMatch?.quantity_in_stock} in stock.
            </Text>

            <Pressable
              onPress={handleAddToExisting}
              className="mb-3 min-h-[52px] items-center justify-center rounded-xl bg-[#2563EB]"
            >
              <Text className="text-base font-semibold text-white">
                Add to existing stock (+{form.quantity || '0'})
              </Text>
            </Pressable>

            <Pressable
              onPress={handleCreateNew}
              className="mb-3 min-h-[52px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white"
            >
              <Text className="text-base font-medium text-[#111827]">
                Create new item
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowDuplicateModal(false)}
              className="min-h-[44px] items-center justify-center"
            >
              <Text className="text-sm font-medium text-[#6B7280]">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
