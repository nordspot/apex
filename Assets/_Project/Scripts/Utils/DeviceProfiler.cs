using UnityEngine;

namespace Apex.Managers
{
    /// <summary>
    /// Detects device capability tier based on hardware specs.
    /// </summary>
    public static class DeviceProfiler
    {
        /// <summary>
        /// Auto-detect device tier from GPU, RAM, and processor.
        /// </summary>
        public static QualityManager.QualityTier DetectTier()
        {
            int systemMemoryMB = SystemInfo.systemMemorySize;
            int graphicsMemoryMB = SystemInfo.graphicsMemorySize;
            int processorCount = SystemInfo.processorCount;
            string gpu = SystemInfo.graphicsDeviceName.ToLowerInvariant();

            // High tier: flagship devices
            if (systemMemoryMB >= 6000 && graphicsMemoryMB >= 3000 && processorCount >= 6)
                return QualityManager.QualityTier.High;

            // Low tier: budget devices
            if (systemMemoryMB < 3000 || graphicsMemoryMB < 1000 || processorCount < 4)
                return QualityManager.QualityTier.Low;

            // Check for known low-end GPUs
            if (gpu.Contains("adreno 5") || gpu.Contains("mali-g5") || gpu.Contains("powervr"))
                return QualityManager.QualityTier.Low;

            return QualityManager.QualityTier.Medium;
        }

        /// <summary>
        /// Log detailed device info for debugging.
        /// </summary>
        public static void LogDeviceInfo()
        {
            Debug.Log($"[DeviceProfiler] Device: {SystemInfo.deviceModel}");
            Debug.Log($"[DeviceProfiler] OS: {SystemInfo.operatingSystem}");
            Debug.Log($"[DeviceProfiler] GPU: {SystemInfo.graphicsDeviceName} ({SystemInfo.graphicsMemorySize} MB)");
            Debug.Log($"[DeviceProfiler] RAM: {SystemInfo.systemMemorySize} MB");
            Debug.Log($"[DeviceProfiler] CPU: {SystemInfo.processorType} x{SystemInfo.processorCount}");
            Debug.Log($"[DeviceProfiler] Max Texture: {SystemInfo.maxTextureSize}");
            Debug.Log($"[DeviceProfiler] Shader Level: {SystemInfo.graphicsShaderLevel}");
        }
    }
}
