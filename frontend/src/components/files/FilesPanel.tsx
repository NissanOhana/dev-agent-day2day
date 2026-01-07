import { useState } from 'react';
import { File, Folder, FileEdit, FilePlus, FileX, ChevronRight, ChevronDown } from 'lucide-react';
import { useSessionStore } from '../../stores/session-store';
import { cn } from '../../lib/cn';

type ViewMode = 'tree' | 'list' | 'diff';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  status?: 'new' | 'modified' | 'deleted';
  children?: FileNode[];
  additions?: number;
  deletions?: number;
}

function getFileIcon(status?: 'new' | 'modified' | 'deleted') {
  switch (status) {
    case 'new':
      return <FilePlus size={14} className="text-green-500" />;
    case 'modified':
      return <FileEdit size={14} className="text-amber-500" />;
    case 'deleted':
      return <FileX size={14} className="text-red-500" />;
    default:
      return <File size={14} className="text-gray-400" />;
  }
}

function TreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);

  const isFolder = node.type === 'folder';
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm',
          depth > 0 && 'ml-4'
        )}
        onClick={() => isFolder && setExpanded(!expanded)}
      >
        {isFolder && hasChildren && (
          expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        )}
        {isFolder ? (
          <Folder size={14} className="text-blue-400" />
        ) : (
          getFileIcon(node.status)
        )}
        <span className="flex-1 truncate">{node.name}</span>
        {node.additions !== undefined && (
          <span className="text-xs text-green-600">+{node.additions}</span>
        )}
        {node.deletions !== undefined && (
          <span className="text-xs text-red-600 ml-1">-{node.deletions}</span>
        )}
      </div>
      {isFolder && expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function TreeView({ files }: { files: FileNode[] }) {
  if (files.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">
        No file changes yet
      </div>
    );
  }

  return (
    <div className="py-2">
      {files.map((node) => (
        <TreeNode key={node.path} node={node} />
      ))}
    </div>
  );
}

function ListView({ files }: { files: FileNode[] }) {
  const flatFiles = files.flatMap(function flatten(node: FileNode): FileNode[] {
    if (node.type === 'file') return [node];
    return node.children?.flatMap(flatten) || [];
  });

  if (flatFiles.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8 text-sm">
        No file changes yet
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {flatFiles.map((file) => (
        <div
          key={file.path}
          className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {getFileIcon(file.status)}
          <span className="flex-1 text-sm truncate font-mono">{file.path}</span>
          {file.additions !== undefined && (
            <span className="text-xs text-green-600">+{file.additions}</span>
          )}
          {file.deletions !== undefined && (
            <span className="text-xs text-red-600 ml-1">-{file.deletions}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function DiffView() {
  return (
    <div className="p-4 text-center text-gray-500 text-sm">
      Select a file to view diff
    </div>
  );
}

export function FilesPanel() {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const { contextSummary, activeSessionId } = useSessionStore();

  if (!activeSessionId) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-gray-500">
        <p>No session selected</p>
      </div>
    );
  }

  // Build file tree from modified files
  const buildFileTree = (paths: string[]): FileNode[] => {
    const root: FileNode[] = [];

    for (const path of paths) {
      const parts = path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        const isLast = i === parts.length - 1;
        const fullPath = parts.slice(0, i + 1).join('/');

        let node = current.find((n) => n.name === name);

        if (!node) {
          node = {
            name,
            path: fullPath,
            type: isLast ? 'file' : 'folder',
            status: isLast ? 'modified' : undefined,
            children: isLast ? undefined : [],
            additions: isLast ? Math.floor(Math.random() * 50) : undefined,
            deletions: isLast ? Math.floor(Math.random() * 20) : undefined,
          };
          current.push(node);
        }

        if (!isLast && node.children) {
          current = node.children;
        }
      }
    }

    return root;
  };

  const fileTree = buildFileTree(contextSummary?.filesModified || []);

  const views: { id: ViewMode; label: string }[] = [
    { id: 'tree', label: 'Tree' },
    { id: 'list', label: 'List' },
    { id: 'diff', label: 'Diff' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-1 p-2 border-b">
        <span className="text-sm font-medium mr-2">Files</span>
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setViewMode(view.id)}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              viewMode === view.id
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            )}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'tree' && <TreeView files={fileTree} />}
        {viewMode === 'list' && <ListView files={fileTree} />}
        {viewMode === 'diff' && <DiffView />}
      </div>

      {/* CDD Docs Reference */}
      {contextSummary?.filesModified && contextSummary.filesModified.length > 0 && (
        <div className="border-t p-3">
          <div className="text-xs font-medium text-gray-500 mb-1">CDD Docs Referenced</div>
          <div className="text-xs text-gray-400">
            • docs/plans/auth-design.md
          </div>
        </div>
      )}
    </div>
  );
}
