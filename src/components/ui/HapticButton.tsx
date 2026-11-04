import { ButtonProps, Button } from 'react-native-paper';
import { withHapticFeedback } from './hapticUtils';

const HapticButton = withHapticFeedback<ButtonProps>(Button as any);
export default HapticButton;
