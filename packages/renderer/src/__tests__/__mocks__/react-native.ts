/**
 * Minimal React Native mock for testing renderer components
 * outside a real RN environment.
 */
export const View = 'View';
export const Text = 'Text';
export const ScrollView = 'ScrollView';
export const TouchableOpacity = 'TouchableOpacity';
export const Image = 'Image';
export const TextInput = 'TextInput';
export const Dimensions = {
  get: () => ({ width: 1024, height: 768 }),
  addEventListener: () => ({ remove: () => {} }),
};
export const StyleSheet = {
  create: (styles: any) => styles,
};
export const Linking = {
  openURL: async () => {},
};
export const Clipboard = {
  setString: () => {},
};
export const Alert = {
  alert: () => {},
};
