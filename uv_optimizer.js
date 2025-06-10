const languages = {
    en: {
        name: "UV Optimizer",
        description: "Automatically optimize UV: supports gap settings, auto-merges similar faces, smart texture compression",
        optimize_uv: "Optimize UV",
        settings: "UV Optimization Settings",
        gap: "Gap between faces (pixels)",
        similarity: "Pixel similarity threshold (%)",
        ignore_effect_pixel: "Ignore if effective pixels below (%)",
        downsize_threshold: "Texture downsize similarity threshold (%)",
        padding: "Padding (pixels)",
        check_flip: "Check flip",
        square: "Square texture",
        only_rearrange: "Only rearrange",
        confirm: "Confirm",
        cancel: "Cancel",
        error: "Error",
        no_elements: "No available model elements",
        no_textures: "No available textures",
        optimizing: "Optimizing UV...",
        complete: "UV optimization complete!",
        failed: "UV optimization failed: ",
        free_model_error: "Free model UV auto-optimization is not supported, please convert the model format and try again"
    },
    zh: {
        name: "UV优化器",
        description: "自动优化UV：支持间隙设置，自动合并相似面，智能压缩纹理",
        optimize_uv: "UV优化",
        settings: "UV优化设置",
        gap: "面之间的间隙(像素)",
        similarity: "像素相似度阈值(%)",
        ignore_effect_pixel: "有效像素低于忽略(%)",
        downsize_threshold: "缩小纹理相似度阈值(%)",
        padding: "内边距(像素)",
        check_flip: "检测翻转",
        square: "等宽高",
        only_rearrange: "仅重排",
        confirm: "确认",
        cancel: "取消",
        error: "错误",
        no_elements: "没有可用的模型元素",
        no_textures: "没有可用的纹理",
        optimizing: "UV优化中...",
        complete: "UV优化完成!",
        failed: "UV优化失败: ",
        free_model_error: "不支持自由模型UV自动优化，请转换模型格式后再试"
    }
};

let button;

(function () {
    // 插件信息
    const id = "uv_optimizer";
    const icon = "fa-th";
    const author = "MCNeteaseDevs";
    const ignoredFormatIds = ["free"];  // ignore specific formats ids, uv optimizer

    const lang = getLanguage();

    // 获取当前语言
    function getLanguage() {
        return Blockbench.Language || 'en';
    }

    // 获取翻译文本
    function t(key) {
        return languages[lang]?.[key] || languages['en'][key] || key;
    }

    // 注册插件
    var plugin = {
        id,
        name: t('name'),
        icon,
        author,
        description: t('description'),
        version: "1.0.1",
        variant: "both",
        onload() {
            // 注册主菜单按钮
            button = new Action("optimize_uv", {
                name: t('optimize_uv'),
                icon: icon,
                category: "edit",
                click: function () {
                    if(ignoredFormatIds.includes(Project.format.id)) {
                        Blockbench.showMessageBox({
                            title: t('error'),
                            message: t('free_model_error'),
                            icon: "error",
                        });
                        return
                    }
                    showDialog();
                },
            });
            MenuBar.addAction(button, "tools");
        },
        onunload() {
            button.delete();
        },
    };

    // 显示设置对话框
    function showDialog() {
        var dialog = new Dialog({
            id: "uv_optimizer_settings",
            title: t('settings'),
            width: 400,
            buttons: [t('confirm'), t('cancel')],
            form: {
                gap: {
                    label: t('gap'),
                    type: "number",
                    value: 0,
                    min: 0,
                    max: 10,
                },
                similarity: {
                    label: t('similarity'),
                    type: "number",
                    value: 90,
                    min: 50,
                    max: 100,
                },
                ignoreEffectPixelPercent: {
                    label: t('ignore_effect_pixel'),
                    type: "number",
                    value: 1,
                    min: 0,
                    max: 100,
                },
                downsizeThreshold: {
                    label: t('downsize_threshold'),
                    type: "number",
                    value: 90,
                    min: 50,
                    max: 100,
                },
                padding: {
                    label: t('padding'),
                    type: "number",
                    value: 0,
                    min: 0,
                    max: 5,
                },
                checkFlip: { label: t('check_flip'), type: "checkbox", value: true },
                square: { label: t('square'), type: "checkbox", value: false },
                onlyRearrange: { label: t('only_rearrange'), type: "checkbox", value: false },
            },
            onConfirm: function (formData) {
                optimizeUV(formData);
            },
        });
        dialog.show();
    }

    // 主要优化函数
    function optimizeUV(settings) {
        // 确保有活动的模型
        if (!Project || !Project.elements || Project.elements.length === 0) {
            Blockbench.showMessageBox({
                title: t('error'),
                message: t('no_elements'),
                icon: "error",
            });
            return;
        }

        if (!Texture.all || Texture.all.length === 0) {
            Blockbench.showMessageBox({
                title: t('error'),
                message: t('no_textures'),
                icon: "error",
            });
            return;
        }

        Undo.initEdit({ elements: Project.elements, uv_only: true });

        try {
            Blockbench.showQuickMessage(t('optimizing'), 2000);

            // 步骤1: 收集所有面并分析其纹理内容
            let allFaces = collectFaces(settings.ignoreEffectPixelPercent / 100);

            // 步骤2: 优化每个面组的纹理尺寸
            optimizeTextureSize(allFaces, settings.downsizeThreshold, settings.onlyRearrange);

            // 步骤3: 按相似度分组面
            let faceGroups = groupSimilarFaces(
                allFaces,
                settings.similarity,
                settings.checkFlip,
                settings.onlyRearrange
            );

            // 步骤4: 重排UV
            rearrangeUV(faceGroups, settings.gap, settings.padding, settings.square);

            Blockbench.showQuickMessage(t('complete'), 2000);
        } catch (e) {
            console.error(e);
            Blockbench.showMessageBox({
                title: t('error'),
                message: t('failed') + e.message,
                icon: "error",
            });
        }

        Undo.finishEdit("优化UV");
        Canvas.updateView({
            elements: Project.elements,
            element_aspects: { uv: true },
        });
    }

    // 收集所有面
    function collectFaces(ignorePixelPercent) {
        let faces = [];
        Project.elements.forEach((element) => {
            if (element.type === "cube") {
                for (let faceKey in element.faces) {
                    let face = element.faces[faceKey];
                    if (face.uv) {
                        faces.push({
                            element: element,
                            faceKey: faceKey,
                            face: face,
                            textureData: getTextureData(face, ignorePixelPercent),
                        });
                    }
                }
            }
        });

        return faces;
    }

    // 获取面的纹理数据
    function getTextureData(face, ignorePixelPercent) {
        if (Texture.all.length <= 0) return null;
        let texture = Texture.all[0];
        if (face.texture)
            texture = Texture.all.find((t) => t.uuid === face.texture);
        if (!texture || !texture.img) return null;

        const scaleW = texture.width / Project.texture_width;
        const scaleH = texture.height / Project.texture_height;

        // 获取UV区域的像素数据
        let uvX1 = (face.uv[0]);
        let uvY1 = (face.uv[1]);
        let uvX2 = (face.uv[2]);
        let uvY2 = (face.uv[3]);

        let width = uvX2 - uvX1;
        let height = uvY2 - uvY1;

        if (width == 0 || height == 0) {
            return { texture, width: 0, height: 0, data: null };
        }
        let canvasTemp = document.createElement("canvas");
        let ctxTemp = canvasTemp.getContext("2d");
        canvasTemp.width = Math.abs(width * scaleW);
        canvasTemp.height = Math.abs(height * scaleH);
        if (canvasTemp.width < 1 || canvasTemp.height < 1) {
            return { texture, width: 0, height: 0, data: null };
        }
        ctxTemp.drawImage(
            texture.img,
            uvX1 * scaleW,
            uvY1 * scaleH,
            width * scaleW,
            height * scaleH,
            0,
            0,
            canvasTemp.width,
            canvasTemp.height,
        );
        // 获取UV区域的图像数据
        let imageData = ctxTemp.getImageData(0, 0, canvasTemp.width, canvasTemp.height);
        let valid = 0;
        let pixelTotal = imageData.data.length / 4;
        for (let i = 0; i < pixelTotal; i++) {
            let a = imageData.data[i * 4 + 3];
            if (a > 0) valid += 1;
        }
        if (valid / pixelTotal < ignorePixelPercent) {
            return { texture, width: 1, height: 1, data: null };
        }
        return {
            texture: texture,
            width: width,
            height: height,
            scaleW,
            scaleH,
            data: imageData.data,
            original: {
                canvas: canvasTemp,
                canvasCtx: ctxTemp,
                uvX1,
                uvY1,
                uvX2,
                uvY2,
                width,
                height,
            },
        };
    }

    // 根据相似性分组面
    function groupSimilarFaces(faces, similarityThreshold, checkFlip, onlyRearrange) {
        let groups = [];

        faces.forEach((face) => {
            // 跳过没有有效纹理数据的面
            if (!face.textureData || !face.textureData.data) {
                groups.push([face]);
                return;
            }

            let foundGroup = false;
            let similarityScore = similarityThreshold / 100; // 转换为0-1的值
            if (!onlyRearrange) {
                // 对每个组，检查面是否与组内第一个面相似
                for (let i = 0; i < groups.length; i++) {
                    let group = groups[i];
                    let reference = group[0];

                    // 跳过没有有效纹理数据的参考面
                    if (!reference.textureData || !reference.textureData.data) {
                        continue;
                    }

                    // 检查尺寸是否兼容 - 必须是相同尺寸才能比较
                    if (
                        Math.abs(face.optimizedSize.width) !== Math.abs(reference.optimizedSize.width) ||
                        Math.abs(face.optimizedSize.height) !== Math.abs(reference.optimizedSize.height)
                    ) {
                        continue;
                    }

                    let result = areSimilar(
                        face,
                        reference,
                        similarityScore,
                        checkFlip
                    );
                    if (result.similar) {
                        console.log(`相似优化 ${result.similarity.toFixed(2)} ${result.flipped}`);
                        face.flipped = result.flipped;
                        face.rotated = result.rotated;
                        group.push(face);
                        foundGroup = true;
                        break;
                    }
                }
            }

            // 如果没找到相似组，创建新组
            if (!foundGroup) {
                face.flipped = false;
                face.rotated = 0;
                groups.push([face]);
            }
        });

        return groups;
    }

    // 检查两个面是否相似
    function areSimilar(face1, face2, threshold, checkFlip) {
        const textureData1 = face1.textureData;
        const textureData2 = face2.textureData;
        if (!textureData1.data || !textureData2.data) {
            return { similar: false };
        }

        const width = Math.abs(face1.optimizedSize.width);
        const height = Math.abs(face1.optimizedSize.height);
        const pixelData1 = face1.optimizedSize.data;
        const pixelData2 = face2.optimizedSize.data;

        // 检查正常的相似度
        let normalSimilarity = calculateSimilarity(
            pixelData1,
            pixelData2,
        );
        if (normalSimilarity >= threshold) {
            return { similar: true, flipped: false, rotated: 0, similarity: normalSimilarity };
        }

        // 如果需要检查翻转
        if (checkFlip) {
            // 水平翻转
            let horizontalFlipped = new Uint8ClampedArray(pixelData1.length);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let srcPos = (y * width + x) * 4;
                    let dstPos = (y * width + (width - 1 - x)) * 4;
                    for (let c = 0; c < 4; c++) {
                        horizontalFlipped[dstPos + c] = pixelData1[srcPos + c];
                    }
                }
            }
            let hFlipSimilarity = calculateSimilarity(
                horizontalFlipped,
                pixelData2,
            );
            if (hFlipSimilarity >= threshold) {
                return { similar: true, flipped: "horizontal", rotated: 0, similarity: hFlipSimilarity };
            }

            // 垂直翻转
            let verticalFlipped = new Uint8ClampedArray(pixelData1.length);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let srcPos = (y * width + x) * 4;
                    let dstPos = ((height - 1 - y) * width + x) * 4;
                    for (let c = 0; c < 4; c++) {
                        verticalFlipped[dstPos + c] = pixelData1[srcPos + c];
                    }
                }
            }
            let vFlipSimilarity = calculateSimilarity(
                verticalFlipped,
                pixelData2,
            );
            if (vFlipSimilarity >= threshold) {
                return { similar: true, flipped: "vertical", rotated: 0, similarity: vFlipSimilarity };
            }

            // 水平+垂直翻转 (180度旋转)
            let bothFlipped = new Uint8ClampedArray(pixelData1.length);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let srcPos = (y * width + x) * 4;
                    let dstPos = ((height - 1 - y) * width + (width - 1 - x)) * 4;
                    for (let c = 0; c < 4; c++) {
                        bothFlipped[dstPos + c] = pixelData1[srcPos + c];
                    }
                }
            }
            let bothFlipSimilarity = calculateSimilarity(
                bothFlipped,
                pixelData2,
            );
            if (bothFlipSimilarity >= threshold) {
                return { similar: true, flipped: "both", rotated: 180, similarity: bothFlipSimilarity };
            }
        }

        return { similar: false };
    }

    // 计算两个像素数组的相似度
    function calculateSimilarity(pixelData1, pixelData2, ignoreAlpha = false) {
        let totalPixels = pixelData1.length / 4;
        let matchingPixels = 0;

        // 像素匹配阈值 (0-255 范围内的差异)
        const pixelMatchThreshold = 1; // 增加一点容错率

        for (let i = 0; i < totalPixels; i++) {
            let pos = i * 4;
            let match = true;
            let valid = pixelData1[pos + 3] * pixelData2[pos + 3] > 0;
            // 检查RGBA通道的差异
            for (let c = 0; c < 4; c++) {
                if (
                    Math.abs(pixelData1[pos + c] - pixelData2[pos + c]) >
                    pixelMatchThreshold
                ) {
                    match = false;
                    break;
                }
            }
            if (match) matchingPixels += 1;
        }
        if (totalPixels == 0) return 1;

        return matchingPixels / totalPixels;
    }

    // 新增: 优化纹理尺寸函数
    function optimizeTextureSize(faces, similarityThreshold, onlyRearrange) {
        const threshold = onlyRearrange ? 1.1 : similarityThreshold / 100; // 转换为0-1的值

        faces.forEach(face => {
            if (!face.textureData || !face.textureData.data) return;

            const originalData = face.textureData;
            // 原始纹理的Canvas
            const originalCanvas = originalData.original.canvas;
            const tWidth = originalCanvas.width;
            const tHeight = originalCanvas.height;

            // 获取原始像素数据
            const originalPixelData = originalData.data;

            // 初始化最佳尺寸和当前尺寸
            let bestWidth = tWidth;
            let bestHeight = tHeight;
            let currentWidth = tWidth;
            let currentHeight = tHeight;

            let smallCanvas = document.createElement('canvas');
            let smallCtx = smallCanvas.getContext('2d', { willReadFrequently: true });
            smallCanvas.width = currentWidth;
            smallCanvas.height = currentHeight;
            smallCtx.imageSmoothingEnabled = false;

            let upscaledCanvas = document.createElement('canvas');
            let upscaledCtx = upscaledCanvas.getContext('2d', { willReadFrequently: true });
            upscaledCanvas.width = originalCanvas.width;
            upscaledCanvas.height = originalCanvas.height;
            upscaledCtx.imageSmoothingEnabled = false;

            let bestData = originalPixelData;

            // 逐步减半尺寸并检查相似度
            while (currentWidth > 1 || currentHeight > 1) {
                smallCtx.clearRect(0, 0, smallCanvas.width, smallCanvas.height);
                // 减半尺寸
                currentWidth = Math.max(1, Math.floor(currentWidth / 2));
                currentHeight = Math.max(1, Math.floor(currentHeight / 2));

                // 绘制缩小的图像
                smallCtx.drawImage(
                    originalCanvas,
                    0, 0,
                    originalCanvas.width, originalCanvas.height,
                    0, 0,
                    currentWidth, currentHeight
                );

                // 创建放大回原尺寸的Canvas
                upscaledCtx.clearRect(0, 0, upscaledCanvas.width, upscaledCanvas.height);
                // 绘制放大的图像
                upscaledCtx.drawImage(
                    smallCanvas,
                    0, 0,
                    currentWidth, currentHeight,
                    0, 0,
                    upscaledCanvas.width, upscaledCanvas.height
                );

                // 获取放大后的像素数据
                const upscaledPixelData = upscaledCtx.getImageData(
                    0, 0,
                    upscaledCanvas.width,
                    upscaledCanvas.height
                ).data;

                // 计算相似度
                const similarity = calculateSimilarity(
                    originalPixelData,
                    upscaledPixelData,
                    onlyRearrange
                );

                // 如果相似度低于阈值，使用上一个尺寸
                if (similarity < threshold) {
                    break;
                }

                // 更新最佳尺寸
                bestWidth = currentWidth;
                bestHeight = currentHeight;

                bestData = smallCtx.getImageData(0, 0, currentWidth, currentHeight).data;
            }

            // 存储优化后的尺寸
            const optimizedSize = {
                width: bestWidth * Math.sign(originalData.width),
                height: bestHeight * Math.sign(originalData.height),
                data: bestData
            };
            face.optimizedSize = optimizedSize;
            if (tWidth != bestWidth || tHeight != bestHeight) {
                console.log(`压缩优化: ${tWidth}x${tHeight} -> ${bestWidth}x${bestHeight}`);
            }
        });
    }

    // 重排UV
    function rearrangeUV(faceGroups, gap, padding, square) {
        // 获取纹理
        const mainTexture = Texture.all[0];
        if (!mainTexture) return;

        // 从16x16开始
        let canvasSize = {
            width: 16,
            height: 16,
        };

        // 计算每组面需要的UV空间，使用优化后的尺寸
        let groupSizes = faceGroups.map((group) => {
            let reference = group[0];
            let size = { width: 0, height: 0 };

            // 使用优化后的尺寸，如果存在
            if (reference.optimizedSize) {
                size.width = Math.abs(reference.optimizedSize.width);
                size.height = Math.abs(reference.optimizedSize.height);
            } else if (reference.textureData) {
                size.width = Math.abs(reference.textureData.width);
                size.height = Math.abs(reference.textureData.height);
            } else {
                let faceUV = reference.face.uv;
                size.width = Math.abs(faceUV[2] - faceUV[0]);
                size.height = Math.abs(faceUV[3] - faceUV[1]);
            }

            size.width += padding * 2;
            size.height += padding * 2;

            return {
                width: size.width,
                height: size.height,
                faces: group,
                area: size.width * size.height,
            };
        });

        groupSizes.sort((a, b) => b.area - a.area);

        let success = false;
        let uvPositions = [];
        let r = 0;
        const resize = square ? [2, 2, 2, 2] : [2, 1, 1, 2];

        // 循环尝试不同的画布大小直到成功
        while (
            !success &&
            canvasSize.width <= mainTexture.width &&
            canvasSize.height <= mainTexture.height
        ) {
            let packer = new RectanglePacker(canvasSize.width, canvasSize.height);
            uvPositions = [];
            success = true;

            for (let i = 0; i < groupSizes.length; i++) {
                let group = groupSizes[i];
                let position = packer.insert(
                    group.width + gap,
                    group.height + gap
                );

                if (position) {
                    uvPositions.push({
                        x: position.x,
                        y: position.y,
                        width: group.width,
                        height: group.height,
                        group: group.faces,
                        padding: padding, // 添加内边距信息
                    });
                } else {
                    success = false;
                    // 画布大小加倍
                    canvasSize.width *= resize[r * 2];
                    canvasSize.height *= resize[r * 2 + 1];
                    r = (r + 1) % 2;
                    break;
                }
            }
        }

        Project.texture_width = canvasSize.width;
        Project.texture_height = canvasSize.height;

        // 应用新的UV坐标
        uvPositions.forEach((position) => {
            let group = position.group;
            group.forEach((faceInfo) => {
                let face = faceInfo.face;
                let offsetX = padding;
                let offsetY = padding;

                // 根据旋转和翻转调整UV
                let uvWidth = position.width - padding * 2;
                let uvHeight = position.height - padding * 2;

                let uvCoords = [
                    position.x + offsetX,
                    position.y + offsetY,
                    position.x + offsetX + uvWidth,
                    position.y + offsetY + uvHeight,
                ];
                if (faceInfo.textureData.width < 0) {
                    uvCoords[0] += uvWidth;
                    uvCoords[2] -= uvWidth;
                }
                if (faceInfo.textureData.height < 0) {
                    uvCoords[1] += uvHeight;
                    uvCoords[3] -= uvHeight;
                }

                // 应用翻转和旋转
                if (faceInfo.flipped === "horizontal") {
                    [uvCoords[0], uvCoords[2]] = [uvCoords[2], uvCoords[0]];
                } else if (faceInfo.flipped === "vertical") {
                    [uvCoords[1], uvCoords[3]] = [uvCoords[3], uvCoords[1]];
                } else if (faceInfo.flipped === "both") {
                    [uvCoords[0], uvCoords[2]] = [uvCoords[2], uvCoords[0]];
                    [uvCoords[1], uvCoords[3]] = [uvCoords[3], uvCoords[1]];
                }

                if (faceInfo.rotated === 90) {
                    let centerX = (uvCoords[0] + uvCoords[2]) / 2;
                    let centerY = (uvCoords[1] + uvCoords[3]) / 2;
                    let halfWidth = Math.abs(uvCoords[2] - uvCoords[0]) / 2;
                    let halfHeight = Math.abs(uvCoords[3] - uvCoords[1]) / 2;

                    uvCoords = [
                        centerX - halfHeight,
                        centerY - halfWidth,
                        centerX + halfHeight,
                        centerY + halfWidth,
                    ];
                } else if (faceInfo.rotated === 270) {
                    let centerX = (uvCoords[0] + uvCoords[2]) / 2;
                    let centerY = (uvCoords[1] + uvCoords[3]) / 2;
                    let halfWidth = Math.abs(uvCoords[2] - uvCoords[0]) / 2;
                    let halfHeight = Math.abs(uvCoords[3] - uvCoords[1]) / 2;

                    uvCoords = [
                        centerX - halfHeight,
                        centerY - halfWidth,
                        centerX + halfHeight,
                        centerY + halfWidth,
                    ];
                    [uvCoords[0], uvCoords[2]] = [uvCoords[2], uvCoords[0]];
                    [uvCoords[1], uvCoords[3]] = [uvCoords[3], uvCoords[1]];
                }

                face.uv = uvCoords;
            });
        });

        updateTextureData(canvasSize, uvPositions, mainTexture);
    }

    // 创建新的纹理图像
    function updateTextureData(canvasSize, uvPositions, mainTexture) {
        // 创建一个新的Canvas作为目标纹理
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        canvas.width = canvasSize.width;
        canvas.height = canvasSize.height;

        // 先绘制一个透明背景
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 对每个面组，将其纹理数据复制到新位置
        uvPositions.forEach((position, groupIndex) => {
            let group = position.group;
            let firstFace = group[0];

            // 只处理有有效纹理数据的面
            if (firstFace.textureData && firstFace.textureData.data) {
                // 获取原始UV和新UV
                let originalData = firstFace.textureData;
                let origUV = originalData.original;
                const scaleW = originalData.scaleW;
                const scaleH = originalData.scaleH;

                // 获取原始纹理
                let srcTexture = originalData.texture;

                // 考虑翻转和旋转
                let flipped = firstFace.flipped;
                let rotated = firstFace.rotated;

                // 创建临时Canvas处理纹理转换
                let tempCanvas = document.createElement("canvas");
                let tempCtx = tempCanvas.getContext("2d");
                const w = Math.abs(origUV.width);
                const h = Math.abs(origUV.height);
                tempCanvas.width = w * scaleW;
                tempCanvas.height = h * scaleH;

                // 在临时Canvas上绘制原始纹理区域
                tempCtx.drawImage(
                    srcTexture.img,
                    origUV.uvX1 * scaleW,
                    origUV.uvY1 * scaleH,
                    origUV.width * scaleW,
                    origUV.height * scaleH,
                    0,
                    0,
                    w * scaleW,
                    h * scaleH
                );

                // 如果需要处理翻转和旋转
                if (flipped || rotated) {
                    let processedCanvas = document.createElement("canvas");
                    let processedCtx = processedCanvas.getContext("2d");
                    processedCanvas.width = tempCanvas.width;
                    processedCanvas.height = tempCanvas.height;

                    processedCtx.imageSmoothingEnabled = false;

                    processedCtx.save();

                    // 设置变换原点到中心
                    processedCtx.translate(processedCanvas.width / 2, processedCanvas.height / 2);

                    // 应用旋转
                    if (rotated) {
                        processedCtx.rotate((rotated * Math.PI) / 180);
                    }

                    // 应用翻转
                    if (flipped === "horizontal") {
                        processedCtx.scale(-1, 1);
                    } else if (flipped === "vertical") {
                        processedCtx.scale(1, -1);
                    } else if (flipped === "both") {
                        processedCtx.scale(-1, -1);
                    }

                    // 绘制变换后的图像
                    processedCtx.drawImage(
                        tempCanvas,
                        -tempCanvas.width / 2,
                        -tempCanvas.height / 2,
                        tempCanvas.width,
                        tempCanvas.height
                    );

                    processedCtx.restore();

                    // 使用处理后的图像
                    tempCanvas = processedCanvas;
                    tempCtx = processedCtx;
                }

                // 将处理后的纹理绘制到新位置
                ctx.imageSmoothingEnabled = false;
                // 考虑内边距
                const padding = position.padding || 0;
                ctx.drawImage(
                    tempCanvas,
                    0,
                    0,
                    tempCanvas.width,
                    tempCanvas.height,
                    position.x + padding,
                    position.y + padding,
                    position.width - padding * 2,
                    position.height - padding * 2
                );
            }
        });

        // 更新原始纹理
        let dataURL = canvas.toDataURL("image/png");

        // 创建新纹理图像对象
        let img = new Image();
        img.onload = function () {
            // 更新纹理
            mainTexture.fromDataURL(dataURL);

            // 刷新画布显示
            Canvas.updateAllUVs();
            Canvas.updateVisibility();
            Canvas.updateView({ textures: [mainTexture] });

            // 通知纹理已更改
            Blockbench.dispatchEvent('update_texture', { texture: mainTexture });
        };
        img.src = dataURL;
    }

    class RectanglePacker {
        constructor(width, height) {
            // 初始化容器宽高
            this.binWidth = width;
            this.binHeight = height;

            // 已放置的矩形列表
            this.placedRectangles = [];

            // 可用空间列表 (初始只有一个大矩形，即整个容器)
            this.freeRectangles = [
                { x: 0, y: 0, width, height }
            ];
        }

        /**
         * 放置一个矩形
         * @param {number} width - 矩形宽度
         * @param {number} height - 矩形高度
         * @param {string} method - 放置策略: 'best-area', 'best-short-side', 'best-long-side', 'bottom-left'
         * @returns {Object|null} - 放置位置，失败返回null
         */
        insert(width, height, method = 'bottom-left') {
            // 检查矩形是否可以放入容器
            if (width > this.binWidth || height > this.binHeight) {
                return null;
            }

            let bestScore = Infinity;
            let bestRectIndex = -1;
            let bestX = 0;
            let bestY = 0;

            // 尝试每一个可用空间
            for (let i = 0; i < this.freeRectangles.length; i++) {
                const freeRect = this.freeRectangles[i];

                // 检查矩形是否能放入当前空间
                if (freeRect.width >= width && freeRect.height >= height) {
                    let score;

                    // 根据不同策略计算分数
                    switch (method) {
                        case 'best-area': //最佳面积适配
                            score = freeRect.width * freeRect.height - width * height;
                            break;
                        case 'best-short-side': //最短边适配
                            score = Math.min(freeRect.width - width, freeRect.height - height);
                            break;
                        case 'best-long-side': //最长边适配
                            score = Math.max(freeRect.width - width, freeRect.height - height);
                            break;
                        case 'bottom-left': //左下角优先
                            score = freeRect.y * 10000 + freeRect.x;
                            break;
                        default:
                            score = freeRect.width * freeRect.height - width * height;
                    }

                    if (score < bestScore) {
                        bestScore = score;
                        bestRectIndex = i;
                        bestX = freeRect.x;
                        bestY = freeRect.y;
                    }
                }
            }

            // 如果没找到合适的空间
            if (bestRectIndex === -1) {
                return null;
            }

            // 在最佳位置放置矩形
            const placedRect = { x: bestX, y: bestY, width, height };
            this.placedRectangles.push(placedRect);

            // 分割被占用的空间，生成新的空闲空间
            this.splitFreeRectangle(bestRectIndex, placedRect);

            // 合并重叠的空闲空间
            this.pruneFreeRectangles();

            return placedRect;
        }

        /**
         * 分割空闲矩形 - 修复重叠问题
         * @param {number} freeRectIndex - 要分割的空闲矩形索引
         * @param {Object} placedRect - 放置的矩形
         */
        splitFreeRectangle(freeRectIndex, placedRect) {
            // 获取被分割的空闲矩形
            const freeRect = this.freeRectangles[freeRectIndex];

            // 记录原始空闲矩形的右边和底边坐标
            const freeRectRight = freeRect.x + freeRect.width;
            const freeRectBottom = freeRect.y + freeRect.height;

            // 记录放置矩形的右边和底边坐标
            const placedRectRight = placedRect.x + placedRect.width;
            const placedRectBottom = placedRect.y + placedRect.height;

            // 移除将被分割的空闲矩形
            this.freeRectangles.splice(freeRectIndex, 1);

            // 尝试创建右侧空闲区域（不重叠）
            if (placedRectRight < freeRectRight) {
                this.freeRectangles.push({
                    x: placedRectRight,
                    y: freeRect.y,
                    width: freeRectRight - placedRectRight,
                    height: freeRect.height
                });
            }

            // 尝试创建底部空闲区域（不重叠）
            if (placedRectBottom < freeRectBottom) {
                this.freeRectangles.push({
                    x: freeRect.x,
                    y: placedRectBottom,
                    width: freeRect.width,
                    height: freeRectBottom - placedRectBottom
                });
            }

            // 尝试创建左侧空闲区域（不与已放置矩形重叠）
            if (placedRect.x > freeRect.x) {
                this.freeRectangles.push({
                    x: freeRect.x,
                    y: freeRect.y,
                    width: placedRect.x - freeRect.x,
                    height: freeRect.height
                });
            }

            // 尝试创建顶部空闲区域（不与已放置矩形重叠）
            if (placedRect.y > freeRect.y) {
                this.freeRectangles.push({
                    x: freeRect.x,
                    y: freeRect.y,
                    width: freeRect.width,
                    height: placedRect.y - freeRect.y
                });
            }
        }

        /**
         * 合并重叠的空闲矩形
         */
        pruneFreeRectangles() {
            // 先删除被完全包含的矩形
            for (let i = 0; i < this.freeRectangles.length; i++) {
                for (let j = i + 1; j < this.freeRectangles.length; j++) {
                    if (j >= this.freeRectangles.length) break;

                    if (this.isContainedIn(this.freeRectangles[i], this.freeRectangles[j])) {
                        this.freeRectangles.splice(i, 1);
                        i--;
                        break;
                    }

                    if (this.isContainedIn(this.freeRectangles[j], this.freeRectangles[i])) {
                        this.freeRectangles.splice(j, 1);
                        j--;
                    }
                }
            }

            // 检测已放置矩形是否与空闲区域重叠，如果重叠则需要进一步分割空闲区域
            for (let i = 0; i < this.freeRectangles.length; i++) {
                const freeRect = this.freeRectangles[i];

                for (const placedRect of this.placedRectangles) {
                    // 检查是否有重叠
                    if (this.isOverlapping(freeRect, placedRect)) {
                        // 将当前空闲矩形分割成不重叠的部分
                        const newRects = this.splitByPlacedRect(freeRect, placedRect);

                        // 移除当前空闲矩形
                        this.freeRectangles.splice(i, 1);
                        i--;

                        // 添加新的非重叠空闲矩形
                        this.freeRectangles.push(...newRects);
                        break;
                    }
                }
            }
        }

        /**
         * 将空闲矩形分割成与已放置矩形不重叠的部分
         */
        splitByPlacedRect(freeRect, placedRect) {
            const result = [];

            // 获取重叠区域边界
            const overlapLeft = Math.max(freeRect.x, placedRect.x);
            const overlapTop = Math.max(freeRect.y, placedRect.y);
            const overlapRight = Math.min(freeRect.x + freeRect.width, placedRect.x + placedRect.width);
            const overlapBottom = Math.min(freeRect.y + freeRect.height, placedRect.y + placedRect.height);

            // 顶部区域
            if (freeRect.y < placedRect.y) {
                result.push({
                    x: freeRect.x,
                    y: freeRect.y,
                    width: freeRect.width,
                    height: placedRect.y - freeRect.y
                });
            }

            // 底部区域
            if ((freeRect.y + freeRect.height) > (placedRect.y + placedRect.height)) {
                result.push({
                    x: freeRect.x,
                    y: placedRect.y + placedRect.height,
                    width: freeRect.width,
                    height: (freeRect.y + freeRect.height) - (placedRect.y + placedRect.height)
                });
            }

            // 左侧区域
            if (freeRect.x < placedRect.x) {
                result.push({
                    x: freeRect.x,
                    y: overlapTop,
                    width: placedRect.x - freeRect.x,
                    height: overlapBottom - overlapTop
                });
            }

            // 右侧区域
            if ((freeRect.x + freeRect.width) > (placedRect.x + placedRect.width)) {
                result.push({
                    x: placedRect.x + placedRect.width,
                    y: overlapTop,
                    width: (freeRect.x + freeRect.width) - (placedRect.x + placedRect.width),
                    height: overlapBottom - overlapTop
                });
            }

            return result;
        }

        /**
         * 检查两个矩形是否重叠
         */
        isOverlapping(rectA, rectB) {
            return !(
                rectA.x + rectA.width <= rectB.x ||
                rectB.x + rectB.width <= rectA.x ||
                rectA.y + rectA.height <= rectB.y ||
                rectB.y + rectB.height <= rectA.y
            );
        }

        /**
         * 检查矩形A是否完全包含在矩形B内
         */
        isContainedIn(rectA, rectB) {
            return rectA.x >= rectB.x && rectA.y >= rectB.y &&
                rectA.x + rectA.width <= rectB.x + rectB.width &&
                rectA.y + rectA.height <= rectB.y + rectB.height;
        }

        /**
         * 获取已放置的矩形
         */
        getPlacedRectangles() {
            return this.placedRectangles;
        }

        /**
         * 获取剩余的空闲空间
         */
        getFreeRectangles() {
            return this.freeRectangles;
        }

        /**
         * 获取空间利用率
         */
        getOccupancyRate() {
            const totalArea = this.binWidth * this.binHeight;
            const usedArea = this.placedRectangles.reduce((sum, rect) => {
                return sum + (rect.width * rect.height);
            }, 0);

            return usedArea / totalArea;
        }

        /**
         * 重置排样器
         */
        reset() {
            this.placedRectangles = [];
            this.freeRectangles = [
                { x: 0, y: 0, width: this.binWidth, height: this.binHeight }
            ];
        }

        /**
         * 验证放置的矩形是否有重叠
         * @returns {boolean} 如果有重叠返回true，否则返回false
         */
        hasOverlappingRectangles() {
            for (let i = 0; i < this.placedRectangles.length; i++) {
                for (let j = i + 1; j < this.placedRectangles.length; j++) {
                    if (this.isOverlapping(this.placedRectangles[i], this.placedRectangles[j])) {
                        return true;
                    }
                }
            }
            return false;
        }
    }

    // 注册插件
    Plugin.register(id, plugin);
})();
