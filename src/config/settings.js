export const settings = {
  messageDelay: parseInt(process.env.MESSAGE_DELAY) || 3000,
  numberDelay: parseInt(process.env.NUMBER_DELAY) || 5000,
  rotationMode: process.env.ROTATION_MODE || 'sequential'
};
