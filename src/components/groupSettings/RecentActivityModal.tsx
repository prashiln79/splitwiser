import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  History,
  Clock,
  Sparkles,
} from 'lucide-react-native';
import { GroupActivity } from '../../types';
import { getGroupActivities } from '../../services/activityService';
import { useAppTheme, ThemeColors } from '../../theme';

interface RecentActivityModalProps {
  visible: boolean;
  groupId: string;
  groupName: string;
  onClose: () => void;
}

export const RecentActivityModal: React.FC<RecentActivityModalProps> = ({
  visible,
  groupId,
  groupName,
  onClose,
}) => {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [activities, setActivities] = useState<GroupActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && groupId) {
      setLoading(true);
      getGroupActivities(groupId)
        .then(setActivities)
        .finally(() => setLoading(false));
    }
  }, [visible, groupId]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Recent Activity</Text>
              <Text style={styles.sheetSubtitle}>Audit history of group changes</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="small" color="#059669" />
            </View>
          ) : (
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
              {activities.length === 0 ? (
                <View style={styles.emptyBox}>
                  <History size={40} color="#9CA3AF" />
                  <Text style={styles.emptyTitle}>No activity recorded yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Settings changes, member updates, and reminders will appear here automatically.
                  </Text>
                </View>
              ) : (
                <View style={styles.timelineList}>
                  {activities.map((act, index) => {
                    const isLast = index === activities.length - 1;
                    const dateStr = act.createdAt
                      ? new Date(act.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';

                    return (
                      <View key={act.id} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <View style={styles.bulletNode}>
                            <Sparkles size={11} color="#059669" />
                          </View>
                          {!isLast && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.timelineRight}>
                          <Text style={styles.activityDesc}>{act.description}</Text>
                          <View style={styles.timeRow}>
                            <Clock size={11} color="#9CA3AF" style={{ marginRight: 4 }} />
                            <Text style={styles.activityTime}>{dateStr}</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '80%',
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    sheetSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    closeBtn: {
      padding: 6,
      borderRadius: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#F3F4F6',
    },
    loaderBox: {
      paddingVertical: 50,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollBody: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    emptyBox: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      marginTop: 12,
      marginBottom: 4,
    },
    emptySubtitle: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },
    timelineList: {
      paddingBottom: 20,
    },
    timelineItem: {
      flexDirection: 'row',
      minHeight: 52,
    },
    timelineLeft: {
      alignItems: 'center',
      width: 28,
    },
    bulletNode: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.2)' : '#ECFDF5',
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(5, 150, 105, 0.3)' : '#A7F3D0',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
    timelineLine: {
      width: 2,
      flex: 1,
      backgroundColor: colors.border,
      marginTop: -2,
      marginBottom: -2,
    },
    timelineRight: {
      flex: 1,
      marginLeft: 10,
      paddingBottom: 14,
    },
    activityDesc: {
      fontSize: 13.5,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 18,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 3,
    },
    activityTime: {
      fontSize: 11,
      color: colors.textMuted,
    },
  });

