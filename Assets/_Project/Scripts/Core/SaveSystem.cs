using System;
using System.IO;
using UnityEngine;
using Apex.Data;

namespace Apex.Core
{
    /// <summary>
    /// JSON-based local save system with backup support.
    /// </summary>
    public static class SaveSystem
    {
        private const string SaveFileName = "apex_save.json";
        private const string BackupFileName = "apex_save.backup.json";

        private static string SavePath => Path.Combine(Application.persistentDataPath, SaveFileName);
        private static string BackupPath => Path.Combine(Application.persistentDataPath, BackupFileName);

        /// <summary>
        /// Save player data to disk.
        /// </summary>
        public static bool Save(PlayerSaveData data)
        {
            try
            {
                // Backup existing save before overwriting
                if (File.Exists(SavePath))
                    File.Copy(SavePath, BackupPath, true);

                string json = JsonUtility.ToJson(data, true);
                File.WriteAllText(SavePath, json);

                Debug.Log("[SaveSystem] Save successful.");
                return true;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SaveSystem] Save failed: {e.Message}");
                return false;
            }
        }

        /// <summary>
        /// Load player data from disk. Returns null if no save exists.
        /// </summary>
        public static PlayerSaveData Load()
        {
            try
            {
                if (!File.Exists(SavePath))
                {
                    Debug.Log("[SaveSystem] No save file found.");
                    return null;
                }

                string json = File.ReadAllText(SavePath);
                var data = JsonUtility.FromJson<PlayerSaveData>(json);

                Debug.Log("[SaveSystem] Load successful.");
                return data;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[SaveSystem] Primary save corrupted: {e.Message}. Trying backup.");
                return LoadBackup();
            }
        }

        /// <summary>
        /// Check if a save file exists.
        /// </summary>
        public static bool HasSave() => File.Exists(SavePath);

        /// <summary>
        /// Delete all save data.
        /// </summary>
        public static void DeleteSave()
        {
            if (File.Exists(SavePath)) File.Delete(SavePath);
            if (File.Exists(BackupPath)) File.Delete(BackupPath);
            Debug.Log("[SaveSystem] Save data deleted.");
        }

        private static PlayerSaveData LoadBackup()
        {
            try
            {
                if (!File.Exists(BackupPath)) return null;

                string json = File.ReadAllText(BackupPath);
                var data = JsonUtility.FromJson<PlayerSaveData>(json);

                // Restore backup as primary
                File.Copy(BackupPath, SavePath, true);
                Debug.Log("[SaveSystem] Restored from backup.");
                return data;
            }
            catch (Exception e)
            {
                Debug.LogError($"[SaveSystem] Backup also corrupted: {e.Message}");
                return null;
            }
        }
    }
}
