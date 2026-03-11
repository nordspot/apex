using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;
using Apex.Data;

namespace Apex.UI
{
    /// <summary>
    /// Dialog tree system for Level 7+ NPC conversations.
    /// Only usable after MEMO-9 acquires the communication module.
    /// </summary>
    public class DialogSystem : MonoBehaviour
    {
        public static event Action<string> OnDialogStarted;
        public static event Action OnDialogEnded;
        public static event Action<string> OnDialogLineShown;

        [SerializeField] private UnityEngine.UI.Text _speakerNameText;
        [SerializeField] private UnityEngine.UI.Text _dialogText;
        [SerializeField] private Transform _choicesContainer;
        [SerializeField] private GameObject _choiceButtonPrefab;
        [SerializeField] private CanvasGroup _dialogCanvas;

        private DialogTree _currentTree;
        private int _currentNodeIndex;
        private bool _isActive;

        /// <summary>
        /// Start a dialog tree.
        /// </summary>
        public void StartDialog(DialogTree tree)
        {
            if (tree == null || tree.nodes.Count == 0) return;

            _currentTree = tree;
            _currentNodeIndex = 0;
            _isActive = true;

            gameObject.SetActive(true);
            if (_dialogCanvas != null)
            {
                _dialogCanvas.alpha = 1f;
                _dialogCanvas.interactable = true;
                _dialogCanvas.blocksRaycasts = true;
            }

            OnDialogStarted?.Invoke(tree.dialogId);
            ShowNode(_currentNodeIndex);
        }

        /// <summary>
        /// Advance to the next node (for linear dialog without choices).
        /// </summary>
        public void AdvanceDialog()
        {
            if (!_isActive || _currentTree == null) return;

            var node = GetNode(_currentNodeIndex);
            if (node == null || node.nextNodeIndex < 0)
            {
                EndDialog();
                return;
            }

            ShowNode(node.nextNodeIndex);
        }

        /// <summary>
        /// Select a dialog choice by index.
        /// </summary>
        public void SelectChoice(int choiceIndex)
        {
            if (!_isActive || _currentTree == null) return;

            var node = GetNode(_currentNodeIndex);
            if (node == null || choiceIndex >= node.choices.Count) return;

            int targetNode = node.choices[choiceIndex].targetNodeIndex;
            if (targetNode < 0)
            {
                EndDialog();
                return;
            }

            ShowNode(targetNode);
        }

        private void ShowNode(int nodeIndex)
        {
            var node = GetNode(nodeIndex);
            if (node == null)
            {
                EndDialog();
                return;
            }

            _currentNodeIndex = nodeIndex;

            // Set dialog text (localization keys — resolve via Localization package in production)
            if (_dialogText != null)
                _dialogText.text = node.textKey;

            if (_speakerNameText != null)
                _speakerNameText.text = _currentTree.speakerNameKey;

            // Show choices
            ClearChoices();
            if (node.choices.Count > 0)
            {
                for (int i = 0; i < node.choices.Count; i++)
                {
                    // In production, instantiate choice buttons from prefab
                    // Placeholder: log choices
                    Debug.Log($"[Dialog] Choice {i}: {node.choices[i].textKey}");
                }
            }

            OnDialogLineShown?.Invoke(node.textKey);
        }

        private void EndDialog()
        {
            _isActive = false;
            _currentTree = null;

            if (_dialogCanvas != null)
            {
                _dialogCanvas.alpha = 0f;
                _dialogCanvas.interactable = false;
                _dialogCanvas.blocksRaycasts = false;
            }

            gameObject.SetActive(false);
            OnDialogEnded?.Invoke();
        }

        private DialogNode GetNode(int index)
        {
            if (_currentTree == null) return null;
            foreach (var node in _currentTree.nodes)
            {
                if (node.nodeIndex == index) return node;
            }
            return null;
        }

        private void ClearChoices()
        {
            if (_choicesContainer == null) return;
            foreach (Transform child in _choicesContainer)
                Destroy(child.gameObject);
        }
    }
}
