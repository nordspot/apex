using System.Collections.Generic;
using UnityEngine;

namespace Apex.Data
{
    /// <summary>
    /// ScriptableObject database for dialog trees (Level 7+).
    /// </summary>
    [CreateAssetMenu(fileName = "DialogDatabase", menuName = "APEX/Dialog Database")]
    public class DialogDatabase : ScriptableObject
    {
        [SerializeField] private List<DialogTree> _dialogTrees = new();

        public DialogTree GetDialog(string dialogId)
        {
            foreach (var tree in _dialogTrees)
            {
                if (tree.dialogId == dialogId) return tree;
            }
            return null;
        }
    }

    [System.Serializable]
    public class DialogTree
    {
        public string dialogId;
        public string speakerNameKey;
        public List<DialogNode> nodes = new();
    }

    [System.Serializable]
    public class DialogNode
    {
        public int nodeIndex;
        public string textKey;          // Localization key
        public List<DialogChoice> choices = new();
        public int nextNodeIndex = -1;  // -1 = end dialog
    }

    [System.Serializable]
    public class DialogChoice
    {
        public string textKey;          // Localization key
        public int targetNodeIndex;
    }
}
