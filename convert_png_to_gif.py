#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PNG转GIF转换脚本
将指定的PNG文件转换为GIF格式
"""

import os
from PIL import Image

# 要转换的PNG文件列表
png_files = ['icon01.png', 'icon02.png', 'icon03.png']

print("开始转换PNG到GIF...")

for png_file in png_files:
    if os.path.exists(png_file):
        # 生成GIF文件名
        gif_file = os.path.splitext(png_file)[0] + '.gif'
        
        try:
            # 打开PNG文件
            with Image.open(png_file) as img:
                # 转换为GIF格式
                img.save(gif_file, format='GIF')
                print(f"✓ 成功转换: {png_file} -> {gif_file}")
        except Exception as e:
            print(f"✗ 转换失败 {png_file}: {e}")
    else:
        print(f"✗ 文件不存在: {png_file}")

print("转换完成！")
