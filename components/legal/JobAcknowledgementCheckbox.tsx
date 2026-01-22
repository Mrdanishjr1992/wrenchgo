import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {
  useJobAcknowledgement,
  CUSTOMER_ACKNOWLEDGEMENT_BULLETS,
  MECHANIC_ACKNOWLEDGEMENT_BULLETS,
} from '../../src/hooks/useTerms';

interface JobAcknowledgementCheckboxProps {
  jobId: string;
  role: 'customer' | 'mechanic';
  onAccepted: () => void;
  disabled?: boolean;
}

export function JobAcknowledgementCheckbox({
  jobId,
  role,
  onAccepted,
  disabled = false,
}: JobAcknowledgementCheckboxProps) {
  const { accepting, acceptAcknowledgement } = useJobAcknowledgement();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bullets = role === 'customer'
    ? CUSTOMER_ACKNOWLEDGEMENT_BULLETS
    : MECHANIC_ACKNOWLEDGEMENT_BULLETS;

  const handleToggle = () => {
    if (!disabled && !accepting) {
      setChecked(!checked);
      setError(null);
    }
  };

  const handleConfirm = async () => {
    if (!checked) {
      setError('Please check the box to acknowledge');
      return;
    }
    const success = await acceptAcknowledgement(jobId, role);
    if (success) {
      onAccepted();
    } else {
      setError('Failed to save acknowledgement. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {role === 'customer' ? 'Customer Acknowledgement' : 'Mechanic Acknowledgement'}
      </Text>
      
      <View style={styles.bulletList}>
        {bullets.map((bullet, index) => (
          <View key={index} style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={handleToggle}
        disabled={disabled || accepting}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>
          I have read and agree to the above
        </Text>
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[
          styles.confirmButton,
          (!checked || accepting || disabled) && styles.confirmButtonDisabled,
        ]}
        onPress={handleConfirm}
        disabled={!checked || accepting || disabled}
      >
        {accepting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.confirmButtonText}>Confirm & Continue</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#11181C',
    marginBottom: 12,
  },
  bulletList: {
    marginBottom: 16,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 8,
  },
  bulletDot: {
    fontSize: 14,
    color: '#0a7ea4',
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#495057',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#adb5bd',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#11181C',
    fontWeight: '500',
  },
  errorText: {
    color: '#e53935',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  confirmButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
