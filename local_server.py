#!/usr/bin/env python3
"""
本地HTTP服务器脚本
用于解决CORS问题，方便本地调试

使用方法：
1. 确保已安装Python 3
2. 双击运行此脚本或在命令行中执行：python local_server.py
3. 打开浏览器访问：http://localhost:8000
"""

import http.server
import socketserver
import webbrowser
import os
import threading
import time

PORT = 8000

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加CORS头
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def log_message(self, format, *args):
        # 自定义日志格式，只显示重要信息
        try:
            if args and isinstance(args[0], str) and ('GET' in args[0] or 'POST' in args[0]):
                super().log_message(format, *args)
        except:
            # 忽略错误，继续运行
            pass

def start_server():
    """启动HTTP服务器"""
    # 杀死占用8000端口的进程
    print("正在检查8000端口...")
    import subprocess
    try:
        # 查找占用8000端口的进程
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True
        )
        if result.stdout:
            # 提取进程ID
            lines = result.stdout.strip().split('\n')
            pids_to_kill = set()
            for line in lines:
                if ':8000' in line:
                    parts = line.split()
                    if len(parts) >= 5:
                        pid = parts[-1]
                        pids_to_kill.add(pid)
            
            # 杀死找到的进程
            for pid in pids_to_kill:
                print(f"发现占用8000端口的进程: PID {pid}")
                # 杀死进程
                kill_result = subprocess.run(
                    ['taskkill', '/PID', pid, '/F'],
                    capture_output=True,
                    text=True
                )
                if kill_result.returncode == 0:
                    print(f"已杀死进程 PID {pid}")
                else:
                    print(f"杀死进程失败: {kill_result.stderr}")
    except Exception as e:
        print(f"检查端口时出错: {e}")
    
    # 获取当前脚本所在目录的父目录（即项目根目录）
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)
    
    print(f"\n本地服务器启动中...")
    print(f"项目根目录: {project_root}")
    print(f"服务器地址: http://localhost:{PORT}")
    print(f"\n正在打开浏览器...")
    
    # 启动浏览器
    def open_browser():
        time.sleep(1)  # 等待服务器启动
        webbrowser.open(f'http://localhost:{PORT}')
    
    browser_thread = threading.Thread(target=open_browser)
    browser_thread.daemon = True
    browser_thread.start()
    
    # 启动服务器
    with socketserver.TCPServer(("", PORT), CORSHTTPRequestHandler) as httpd:
        print(f"\n服务器已启动，按 Ctrl+C 停止\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务器已停止")

if __name__ == "__main__":
    start_server()
