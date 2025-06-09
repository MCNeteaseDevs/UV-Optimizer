# Blockbench Model UV Optimization Plugin

Welcome to the Model UV Optimization Plugin. Please refer to this guide for detailed instructions.

This plugin will automatically optimize UVs. It supports gap configuration, merging similar faces, intelligent texture compression, and more.

# User Guide

## Download

The latest version of the tool can be found in the **Releases** section. Go to Releases to download the

`uv_optimizer.js`

file.

## Installation

1. Open Blockbench, go to **File -> Plugins** to open the plugin interface.

![Image](https://nie.res.netease.com/r/pic/20250507/39d03786-2587-4953-8094-e366dfbca73f.png)

2. Click the **"Load Plugin from File"** button, select the downloaded `.js` plugin file, and wait for the installation to complete.

![Image](https://nie.res.netease.com/r/pic/20250507/dfebe45a-ca18-496f-8c27-bb5aba2938f8.png)

## Usage

### Preparation

1. Open the model you want to optimize (must not be a free model).

![Image](https://nie.res.netease.com/r/pic/20250507/583089e1-fd05-4a97-b05d-c4712871f9f7.png)

2. **Set the UV mode of the model to Per-Face UV**. If not set, the optimization will produce incorrect results.

![Image](https://nie.res.netease.com/r/pic/20250507/5fd76a7f-34c4-4811-9bf6-ee39f8ae0e30.png)

3. In the Tools menu dropdown, a new "UV Optimization" button will appear, added by the plugin.

![Image](https://nie.res.netease.com/r/pic/20250507/47427afe-8e57-4f22-8cb8-12dbee07b30a.png)

### Optimize UV

1. Go to **Tools -> UV Optimization** to open the UV optimization interface.

![Image](https://nie.res.netease.com/r/pic/20250507/f638bc69-6eaa-43d0-a46b-b614bacc9308.png)

2. In most cases, you can leave the parameters as default. After clicking confirm, the program may freeze momentarily — please be patient. Once the freezing ends, the optimization is complete.

### Check

1. **An artist should check whether the optimized model looks correct. Only save if there are no visual issues.**

2. If problems are found after optimization, simply **close the project and reopen it** to restore the pre-optimization state.

## Before & After Comparison

Before Optimization:

![Image](https://nie.res.netease.com/r/pic/20250507/f4d6f85b-978c-45e5-982c-6f226fbcb9fd.png)

After Optimization:

![Image](https://nie.res.netease.com/r/pic/20250507/74c7da24-1488-46eb-91a3-5ce2c61b0c10.png)

## Parameter Explanation

- **Gap Between Faces**: Default is 0. Set to 1 if needed — it leaves a 1-pixel blank area between each texture.

- **Pixel Similarity Threshold**: The higher this value, the worse the texture reuse performance (i.e., faces that could share the same texture may end up using separate textures).

> If you find some parts of the texture have been replaced incorrectly after optimization, try increasing this value. Max is 100.

- **Ignore Faces with Low Effective Pixels**: Ignores faces with very little visible content.

> For example, a face may use a 100x100 UV area, but only 1 pixel is visible. This face can be ignored.

- **Texture Downscaling Similarity Threshold**: Controls how much the texture can be downscaled. Max is 100. Texture downscaling helps reduce resolution.

> For example, a 64x64 texture that only contains content equivalent to 16x16 can be downscaled accordingly.

> If some parts of the texture look incorrect after optimization, try increasing this value.

# Notes

- This plugin does **not** support undo (Ctrl+Z) — there’s no history tracking.

- If the optimization result isn’t satisfactory, try adjusting the **Pixel Similarity Threshold** and **Texture Downscaling Similarity Threshold** values.

- This plugin **does not support** models that use multiple textures.

> If needed, you can optimize the first texture, then manually adjust the second texture based on the first one.

# Contributing

If you find any improvements or want to add new features, feel free to submit a branch in this repository. Don’t forget to leave your name — we appreciate your contribution!
