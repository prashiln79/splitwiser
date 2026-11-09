import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import {
  X,
  Check,
  Home,
  Plane,
  Heart,
  Users,
  Smile,
  Briefcase,
  Folder,
  Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Group, GroupType } from '../../types';

interface EditGroupInfoModalProps {
  visible: boolean;
  group: Group | null;
  isAdmin: boolean;
  memberCount: number;
  creatorName?: string;
  onClose: () => void;
  onSave: (updates: { name: string; type: GroupType; description: string }) => Promise<void>;
}

export const GROUP_TYPES: Array<{
  key: GroupType;
  label: string;
  icon: any;
  color: string;
  bgColor: string;
}> = [
  { key: 'home', label: 'Home', icon: Home, color: '#059669', bgColor: '#ECFDF5' },
  { key: 'trip', label: 'Trip', icon: Plane, color: '#0284C7', bgColor: '#F0F9FF' },
  { key: 'couple', label: 'Couple', icon: Heart, color: '#E11D48', bgColor: '#FFF1F2' },
  { key: 'family', label: 'Family', icon: Users, color: '#D97706', bgColor: '#FFFBEB' },
  { key: 'friends', label: 'Friends', icon: Smile, color: '#7C3AED', bgColor: '#F5F3FF' },
  { key: 'office', label: 'Office', icon: Briefcase, color: '#4B5563', bgColor: '#F3F4F6' },
  { key: 'other', label: 'Other', icon: Folder, color: '#0D9488', bgColor: '#F0FDFA' },
];

export const EditGroupInfoModal: React.FC<EditGroupInfoModalProps> = ({
  visible,
  group,
  isAdmin,
  memberCount,
  creatorName,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GroupType>('home');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && group) {
      setName(group.name || '');
      setDescription(group.description || '');
      setType((((group.type || group.icon || 'home') as string).toLowerCase()) as GroupType);
      setError('');
    }
  }, [visible, group]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Group name cannot be empty');
      return;
    }
    if (name.trim().length > 50) {
      setError('Group name must be 50 characters or less');
      return;
    }
    setError('');
    setSaving(true);
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      await onSave({
        name: name.trim(),
        type,
        description: description.trim(),
      });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save group details');
    } finally {
      setSaving(false);
    }
  };

  const createdDateStr = group?.createdAt
    ? new Date(group.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Group Information</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Group Name Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Group Name *</Text>
              <TextInput
                style={[styles.textInput, !isAdmin && styles.disabledInput]}
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  if (error) setError('');
                }}
                placeholder="e.g. Goa Trip 2026, Apartment 4B"
                placeholderTextColor="#9CA3AF"
                editable={isAdmin && !saving}
                maxLength={50}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            {/* Group Type Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Group Type</Text>
              <Text style={styles.fieldSubLabel}>
                Helps categorize expenses and match relevant cover galleries.
              </Text>
              <View style={styles.typeGrid}>
                {GROUP_TYPES.map((t) => {
                  const isSelected = type === t.key;
                  const IconComp = t.icon;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[
                        styles.typePill,
                        { backgroundColor: isSelected ? t.color : '#F3F4F6' },
                      ]}
                      onPress={() => {
                        if (isAdmin) {
                          setType(t.key);
                          if (Platform.OS !== 'web') {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          }
                        }
                      }}
                      activeOpacity={isAdmin ? 0.8 : 1}
                      disabled={!isAdmin || saving}
                    >
                      <IconComp
                        size={15}
                        color={isSelected ? '#FFFFFF' : '#4B5563'}
                        strokeWidth={2.2}
                      />
                      <Text
                        style={[
                          styles.typePillText,
                          { color: isSelected ? '#FFFFFF' : '#374151' },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textArea, !isAdmin && styles.disabledInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add shared notes, trip dates, or apartment rules..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                editable={isAdmin && !saving}
                maxLength={200}
              />
            </View>

            {/* Read-Only Group Metadata Info Box */}
            <View style={styles.metadataBox}>
              <View style={styles.metaRow}>
                <Info size={15} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.metaSectionTitle}>Group Metadata</Text>
              </View>
              <View style={styles.metaGrid}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Created</Text>
                  <Text style={styles.metaValue}>{createdDateStr || 'Recently'}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Members</Text>
                  <Text style={styles.metaValue}>{memberCount} people</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Join Code</Text>
                  <Text style={[styles.metaValue, { fontWeight: '700', color: '#059669' }]}>
                    {group?.joinCode || '------'}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Currency</Text>
                  <Text style={styles.metaValue}>{group?.currency || 'INR'}</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          {isAdmin && (
            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={saving}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!name.trim() || saving) && styles.disabledBtn]}
                onPress={handleSave}
                disabled={!name.trim() || saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Check size={16} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 6 }} />
                    <Text style={styles.saveBtnText}>Save Details</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inputGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  fieldSubLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '500',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metadataBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  metaSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  metaItem: {
    width: '48%',
  },
  metaLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#059669',
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledBtn: {
    backgroundColor: '#9CA3AF',
  },
});

