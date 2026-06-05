import React, { useState } from 'react';

const TOOL_ICONS = {
  exec_bash: '⚡', glob_files: '📂', grep_code: '🔍', view_file_range: '👁',
  create_file: '📄', search_replace: '✏️', lint_python: '🐍', lint_javascript: '🟡',
  supervisorctl_action: '⚙️', git_log_diff: '📜', screenshot_url: '📸',
  install_pip: '📦', install_yarn: '🧶',
  list_workspace_files: '📂', read_workspace_file: '📖', write_workspace_file: '💾',
  search_replace_workspace: '🔄',
  list_my_vps: '🖥', run_vps_command: '💻', deploy_app_to_vps: '🚀',
  tail_vps_logs: '📋', restart_vps_service: '🔁',
  generate_audio_room_app: '🎙', generate_tiktok_app: '🎵',
  send_whatsapp: '💬', send_sms: '📱', create_stripe_checkout: '💳',
  get_platform_stats: '📊', get_user_info: '👤', list_active_rooms: '🏠',
  send_notification: '🔔',
};

function _abbrev(args) {
  if (!args) return '';
  try {
    const s = typeof args === 'string' ? args : JSON.stringify(args);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  } catch { return ''; }
}

function _prettyResult(result) {
  if (!result) return '';
  try {
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  } catch { return String(result); }
}

export default function EmergentToolCard({ tool }) {
  const [open, setOpen] = useState(false);

  const name   = tool.name || tool.tool || '?';
  const args   = tool.args;
  const result = tool.result;
  const cost   = tool.cost || 0;
  const isErr  = tool.error || (result && typeof result === 'object' && result.error);
  const status = tool.status === 'running' ? 'running' : isErr ? 'error' : 'success';

  const icon   = TOOL_ICONS[name] || '🔧';
  const label  = status === 'running' ? 'running…' : isErr ? 'error' : `✓ ${cost}¢`;

  return (
    <div className={`em-tool-card ${status}`}>
      <div className="em-tool-head" onClick={() => setOpen(o => !o)}>
        <span className="em-tool-icon">{icon}</span>
        <span className="em-tool-name">{name}</span>
        <span className="em-tool-args">{_abbrev(args)}</span>
        <span className={`em-tool-status ${status}`}>{label}</span>
        <span className={`em-tool-chevron${open ? ' open' : ''}`}>▶</span>
      </div>

      {open && (
        <div className="em-tool-body">
          {args && (
            <>
              <div className="em-tool-section-label">INPUT</div>
              <div style={{ marginBottom: 8 }}>{_prettyResult(args)}</div>
            </>
          )}
          {result !== undefined && result !== null && (
            <>
              <div className="em-tool-section-label">OUTPUT</div>
              <div>{_prettyResult(result)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
