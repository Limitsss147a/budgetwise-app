import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { fonts } from '../../constants/fonts';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  confirmColor?: string;
}

export function ConfirmModal({
  visible,
  title,
  description,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  onConfirm,
  onCancel,
  loading = false,
  icon = 'trash-outline',
  iconColor,
  confirmColor,
}: ConfirmModalProps) {
  const { colors } = useTheme();

  const activeIconColor = iconColor || colors.expense;
  const activeConfirmColor = confirmColor || colors.expense;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !loading && onCancel()}>
      <View style={st.modalOverlay}>
        <Pressable style={st.modalBackdrop} onPress={() => !loading && onCancel()} />
        <View style={[st.confirmDialog, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={[st.iconContainer, { backgroundColor: `${activeIconColor}1A` }]}>
              <Ionicons name={icon} size={26} color={activeIconColor} />
            </View>
            <Text style={[st.confirmTitle, { color: colors.text, fontFamily: fonts.bold }]}>{title}</Text>
            <Text style={[st.confirmDesc, { color: colors.textSecondary, fontFamily: fonts.regular }]}>
              {description}
            </Text>
          </View>
          <View style={st.confirmActions}>
            <TouchableOpacity
              style={[st.confirmBtn, { borderColor: colors.border, borderWidth: 1 }]}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={[st.confirmBtnText, { color: colors.textSecondary, fontFamily: fonts.semiBold }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.confirmBtn, { backgroundColor: activeConfirmColor }]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={[st.confirmBtnText, { color: '#FFF', fontFamily: fonts.semiBold }]}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  confirmDialog: { width: '100%', maxWidth: 340, borderRadius: 20, padding: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15 },
  iconContainer: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  confirmTitle: { fontSize: 20, textAlign: 'center' },
  confirmDesc: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  confirmActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  confirmBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontSize: 15 },
});
