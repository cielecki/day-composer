import { WorkspaceLeaf } from "obsidian";

/**
 * Updates all title-related elements for a WorkspaceLeaf:
 * - Tab title (visible text in tab bar)
 * - View header title (inside content area)
 * - Tab tooltip (aria-label on hover)
 */
export function updateLeafTitle(leaf: WorkspaceLeaf, title: string): void {
    // Update the active tab title using the working DOM selector approach
    const activeTabTitle = document.querySelector('.workspace-tabs.mod-active .workspace-tab-header.is-active .workspace-tab-header-inner-title');
    if (activeTabTitle) {
        activeTabTitle.textContent = title;
    }
    
    // Also update the view header title within the leaf content
    const viewHeaderTitle = leaf.view?.containerEl?.querySelector('.view-header-title');
    if (viewHeaderTitle) {
        viewHeaderTitle.textContent = title;
    }
    
    // Update the tab tooltip (aria-label)
    const tabHeaderEl = (leaf as any).tabHeaderEl;
    if (tabHeaderEl) {
        tabHeaderEl.setAttribute('aria-label', title);
    }
} 