// Compatibility boundary: the headless implementation is owned by @ppt/security.
export {
  ElectronSafeStorageDeviceSecretProtector,
  WindowsDpapiDeviceSecretProtector,
  WINDOWS_DPAPI_PROTECTION_ID,
  type DeviceSecretProtector,
  type ElectronSafeStorageLike,
  type WindowsDpapiExecutionResult,
  type WindowsDpapiExecutor
} from '@ppt/security';
