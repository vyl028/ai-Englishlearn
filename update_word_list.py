import re

with open('src/components/word-review-list.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Check if already updated
if 'MobileBulkActions' in content:
    print("File already contains MobileBulkActions, skipping...")
    exit(0)

# Add isMobile hook usage after function starts
# Find the state declarations and add isMobile
old_state = '''const [generatorOpen, setGeneratorOpen] = useState(false);'''
new_state = '''const isMobile = useIsMobile();
  const [generatorOpen, setGeneratorOpen] = useState(false);'''

if old_state in content:
    content = content.replace(old_state, new_state, 1)
    print("Added isMobile hook")

# Update bulk selection UI to use MobileBulkActions for mobile
# Find the bulkMode UI section and add mobile bulk actions
old_bulk_ui = '''{bulkMode && (
              <div className="rounded-md border bg-card p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">'''

new_bulk_ui = '''{bulkMode && !isMobile && (
              <div className="rounded-md border bg-card p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">'''

if old_bulk_ui in content:
    content = content.replace(old_bulk_ui, new_bulk_ui, 1)
    print("Updated bulk selection UI for desktop")

# Add MobileBulkActions component before the closing TooltipProvider
old_tooltip_end = '''    </TooltipProvider>
   );
}'''

new_tooltip_end = '''    </TooltipProvider>

      {/* Mobile Bulk Actions */}
      <MobileBulkActions
        isActive={bulkMode}
        selectedCount={bulkSelectedWordIds.length}
        onClose={() => setBulkMode(false)}
        onSelectAll={() => setBulkSelectedCardKeys(new Set(visibleCards.map((c) => c.cardKey)))}
        onClearSelection={() => setBulkSelectedCardKeys(new Set())}
        actions={[
          {
            id: 'move',
            icon: <FolderInput className="w-5 h-5" />,
            label: '移动',
            color: 'primary',
            onClick: () => {
              if (bulkSelectedWordIds.length === 0) return;
              setBulkMoveOpen(true);
            },
          },
          {
            id: 'delete',
            icon: <Trash className="w-5 h-5" />,
            label: '删除',
            color: 'destructive',
            onClick: () => {
              if (bulkSelectedWordIds.length === 0) return;
              setBulkDeleteOpen(true);
            },
          },
        ]}
      />
   );
}'''

if old_tooltip_end in content:
    content = content.replace(old_tooltip_end, new_tooltip_end, 1)
    print("Added MobileBulkActions component")

with open('src/components/word-review-list.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("WordReviewList updated successfully!")
