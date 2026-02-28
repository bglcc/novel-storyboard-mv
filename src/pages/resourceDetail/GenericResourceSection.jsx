import React from 'react';

const GenericResourceSection = ({
  type,
  tags,
  setTags,
  handleZipUpload,
  handleSingleUpload,
  handleSaveMeta,
  resource,
  openPreview,
  updateResourceImages,
  resourceId
}) = (
  
    {type !== 'characters' && type !== 'scenes' && type !== 'expressions' && type !== 'props' && (
      div className=row
        div
          p上传 zip（自动解压图片）p
          input type=file accept=applicationzip onChange={handleZipUpload} 
        div
        div
          p补充图片（可多选）p
          input type=file accept=image multiple onChange={handleSingleUpload} 
        div
        button onClick={handleSaveMeta}保存信息并返回资源库button
      div
    )}
    {type !== 'scenes' && type !== 'expressions' && (
      label
        标签（逗号分隔）
        input value={tags} onChange={(e) = setTags(e.target.value)} placeholder=角色, 主角 
      label
    )}
    {type !== 'characters' && type !== 'scenes' && type !== 'expressions' && (
      div className=grid
        {(resource.images  []).map((img, idx) = {
          const imageSrc = img.src  img;
          const imageKey = img.id  imageSrc  idx;
          return (
            div key={imageKey} className=item-card
              button type=button className=cover checkerboard onClick={() = openPreview(imageSrc, resource.name)}
                img src={imageSrc} alt={`res-${idx}`} 
              button
              button
                className=danger
                onClick={() =
                  updateResourceImages(
                    type,
                    resourceId,
                    resource.images.filter((_, i) = i !== idx)
                  )
                }
              
                删除图片
              button
            div
          );
        })}
        {(resource.images  []).length === 0 && div className=empty暂无图片，上传 zip 或补充图片。div}
      div
    )}
  
);

export default GenericResourceSection;