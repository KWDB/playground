package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"kwdb-playground/internal/docker"
	"kwdb-playground/internal/websocket"
)

// 测试镜像拉取功能
func main() {
	fmt.Println("开始测试镜像拉取功能...")

	// 创建WebSocket终端管理器
	terminalManager := websocket.NewTerminalManager()

	// 创建Docker控制器
	dockerController, err := docker.NewControllerWithTerminalManager(terminalManager)
	if err != nil {
		log.Fatalf("创建Docker控制器失败: %v", err)
	}
	defer dockerController.Close()

	// 测试镜像：使用alpine镜像，它更适合测试
	testImage := "alpine:latest"
	fmt.Printf("测试镜像: %s\n", testImage)

	// 创建上下文
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// 测试容器配置 - 使用alpine镜像执行持续运行的命令
	containerConfig := &docker.ContainerConfig{
		Image: testImage,
		Cmd:   []string{"sh", "-c", "echo 'Hello from auto-pulled alpine image!' && sleep 5"},
		Env:   map[string]string{},
	}

	// 进度回调函数
	progressCallback := func(progress docker.ImagePullProgress) {
		fmt.Printf("[进度] 镜像: %s, 状态: %s", progress.ImageName, progress.Status)
		if progress.Progress != "" {
			fmt.Printf(", 进度: %s", progress.Progress)
		}
		if progress.Error != "" {
			fmt.Printf(", 错误: %s", progress.Error)
		}
		fmt.Println()
	}

	// 创建容器（这会触发镜像检查和自动拉取）
	fmt.Println("\n开始创建容器（将触发镜像检查和自动拉取）...")
	containerInfo, err := dockerController.CreateContainerWithProgress(ctx, "test-course", containerConfig, progressCallback)
	if err != nil {
		log.Fatalf("创建容器失败: %v", err)
	}

	fmt.Printf("\n✅ 容器创建成功! 容器ID: %s\n", containerInfo.ID)

	// 启动容器
	fmt.Println("启动容器...")
	err = dockerController.StartContainer(ctx, containerInfo.ID)
	if err != nil {
		log.Fatalf("启动容器失败: %v", err)
	}

	fmt.Println("✅ 容器启动成功!")

	// 等待容器执行完成
	time.Sleep(2 * time.Second)

	// 获取容器日志
	fmt.Println("\n获取容器输出...")
	logsReader, err := dockerController.GetContainerLogs(ctx, containerInfo.ID, 100, false)
	if err != nil {
		log.Printf("获取容器日志失败: %v", err)
	} else {
		defer logsReader.Close()
		// 这里简化处理，实际应用中需要读取io.ReadCloser
		fmt.Println("容器日志获取成功")
	}

	// 清理：删除测试容器
	fmt.Println("\n清理测试容器...")
	err = dockerController.RemoveContainer(ctx, containerInfo.ID)
	if err != nil {
		log.Printf("删除容器失败: %v", err)
	} else {
		fmt.Println("✅ 测试容器已清理")
	}

	fmt.Println("\n🎉 镜像拉取功能测试完成!")
}