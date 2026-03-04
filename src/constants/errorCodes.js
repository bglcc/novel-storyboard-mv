/**
 * 资源服务错误码（冻结版本：v1）
 * 1000/1001/1002/1003/9999 为 v1 固定值，禁止直接修改。
 * 后续升级需新增版本对象（例如 v2），不得覆写 v1。
 */
export const ResourceErrorCodes = {
  errorCodeVersion: 'v1',
  SUCCESS: { code: 0, message: '操作成功' },
  PARAM_ERROR: { code: 1000, message: '参数错误' },
  TEMP_RESOURCE_ERROR: { code: 1001, message: '临时素材操作错误' },
  EXPORT_PACKAGE_ERROR: { code: 1002, message: '导出参考包错误' },
  CLEAN_TEMP_ERROR: { code: 1003, message: '清理临时素材错误' },
  SYSTEM_ERROR: { code: 9999, message: '系统异常' },
  checkVersion: (version) => version === ResourceErrorCodes.errorCodeVersion
};