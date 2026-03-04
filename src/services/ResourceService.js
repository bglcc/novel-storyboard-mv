import { ResourceErrorCodes } from '../constants/errorCodes';

const buildResponse = ({ success, code, message, data = null }) => ({
  success,
  code,
  message,
  errorCodeVersion: ResourceErrorCodes.errorCodeVersion,
  data
});

export const ResourceService = {
  uploadMaterial: async (file, resourceType = '', namespace = 'default') => {
    try {
      if (!file) {
        return buildResponse({
          success: false,
          code: ResourceErrorCodes.PARAM_ERROR.code,
          message: ResourceErrorCodes.PARAM_ERROR.message
        });
      }

      const resourceId = `${resourceType || 'resource'}-${namespace}-${Date.now()}`;
      return buildResponse({
        success: true,
        code: ResourceErrorCodes.SUCCESS.code,
        message: '上传成功',
        data: resourceId
      });
    } catch (error) {
      return buildResponse({
        success: false,
        code: ResourceErrorCodes.SYSTEM_ERROR.code,
        message: `上传失败：${error?.message || '未知错误'}`
      });
    }
  }
};