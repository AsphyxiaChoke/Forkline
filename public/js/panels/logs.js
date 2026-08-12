// Running and completed Git operation logs.
function renderLogsTab() {
  const logs = state.data?.operationLog || [];
  const running = state.data?.runningOperations || [];
  const diagnostics = getUiDiagnostics();
  els.detailTitle.textContent = t("操作日志");
  const operationSummary = running.length
    ? t("{count} 个 Git 操作正在执行", { count: running.length })
    : logs.length
      ? t("最近 {count} 条 Git 操作", { count: logs.length })
      : t("还没有执行过 Git 操作");
  els.detailSub.textContent = diagnostics.length
    ? `${operationSummary} · ${t("{count} 条界面诊断", { count: diagnostics.length })}`
    : operationSummary;
  els.detailNode.style.borderColor = running.length || logs.some((item) => item.status === "error") || diagnostics.length ? "var(--amber)" : "var(--teal)";
  setActiveDiff(null);
  els.detailBody.innerHTML = tt`
    ${renderUiDiagnosticsSection(diagnostics)}
    <div class="logs-toolbar">
      <div>
        <strong>最近操作</strong>
        <span>成功、失败、耗时和 Git 输出摘要</span>
      </div>
      <button class="mini-btn" data-log-refresh type="button">刷新</button>
    </div>
    ${
      running.length
        ? `<section class="running-log-section">
            <div class="running-log-title">进行中</div>
            <div class="operation-log-list">${running.map(renderRunningOperationItem).join("")}</div>
          </section>`
        : ""
    }
    <div class="operation-log-list">
      ${
        logs.length
          ? logs.map(renderOperationLogItem).join("")
          : `<div class="log-empty">${t("执行抓取、提交、切换、合并、储藏等操作后，会在这里显示结果。")}</div>`
      }
    </div>
  `;
}

function renderRunningOperationItem(item) {
  const duration = item.elapsed || formatDurationText(item.durationMs);
  const phaseLabel = item.cancelRequested
    ? t("取消中")
    : item.phase === "preparing"
      ? t("准备中")
      : item.phase === "finishing"
        ? t("收尾中")
        : t("进行中");
  const command = item.command || t("正在准备 Git 命令");
  const output = item.outputTail || (item.cancelRequested
    ? t("正在终止 Git 进程，请稍候。")
    : t("等待 Git 输出。若长时间没有变化，请检查认证窗口或网络状态。"));
  return tt`
    <article class="operation-log-item running">
      <div class="operation-log-head">
        <span class="log-status">${escapeHtml(phaseLabel)}</span>
        <strong title="${escapeAttr(t(item.label || ""))}">${escapeHtml(t(item.label || "Git 操作"))}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.startedTime || "")}</span>
        <code>${escapeHtml(item.action || "")}</code>
      </div>
      <div class="operation-log-command">
        <code title="${escapeAttr(command)}">${escapeHtml(command)}</code>
        ${item.cancelSupported ? `<button class="mini-btn danger" data-operation-cancel="${escapeAttr(item.id)}" type="button" ${item.cancellable ? "" : "disabled"}>${escapeHtml(item.cancelRequested ? t("取消中") : t("取消操作"))}</button>` : ""}
      </div>
      <pre>${escapeHtml(output)}</pre>
    </article>
  `;
}

function renderUiDiagnosticsSection(diagnostics = getUiDiagnostics()) {
  return tt`
    <section class="ui-diagnostics-section">
      <div class="logs-toolbar">
        <div>
          <strong>界面诊断</strong>
          <span>记录超过 200ms 的主线程阻塞和未处理错误，刷新页面后仍保留</span>
        </div>
        <div class="logs-toolbar-actions">
          <button class="mini-btn" data-ui-diagnostics-copy type="button">复制诊断</button>
          <button class="mini-btn" data-ui-diagnostics-clear type="button" ${diagnostics.length ? "" : "disabled"}>清空</button>
        </div>
      </div>
      <div class="operation-log-list ui-diagnostics-list">
        ${diagnostics.length
          ? diagnostics.map(renderUiDiagnosticItem).join("")
          : `<div class="log-empty">${t("没有记录到界面卡顿或前端错误。")}</div>`}
      </div>
    </section>
  `;
}

function renderUiDiagnosticItem(item) {
  const typeLabels = {
    error: "界面错误",
    rejection: "异步错误",
    longtask: "主线程阻塞",
    "editor-slow": "编辑器降级",
  };
  const context = item.context || {};
  const editor = context.editor || null;
  const file = editor?.file || context.selectedFile || "";
  const ref = context.branch || context.selectedRef || "";
  const contextText = [file, ref, editor?.lightweight ? t("轻量模式") : ""].filter(Boolean).join(" · ");
  const message = item.type === "longtask"
    ? t("浏览器主线程出现长时间阻塞。")
    : item.type === "editor-slow"
      ? t("文件对照创建过慢，已自动切换为轻量模式。")
      : String(item.message || t("没有错误说明"));
  const time = String(item.time || "").replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  return tt`
    <article class="operation-log-item ui-diagnostic-item ${item.type === "error" || item.type === "rejection" ? "error" : "running"}">
      <div class="operation-log-head">
        <span class="log-status">${escapeHtml(t(typeLabels[item.type] || "诊断"))}</span>
        <strong title="${escapeAttr(message)}">${escapeHtml(message)}</strong>
        <em>${escapeHtml(item.durationMs ? formatDurationText(item.durationMs) : "")}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(time)}</span>
        <code title="${escapeAttr(contextText)}">${escapeHtml(contextText)}</code>
      </div>
      ${item.stack ? `<details class="ui-diagnostic-stack"><summary>${t("错误堆栈")}</summary><pre>${escapeHtml(item.stack)}</pre></details>` : ""}
    </article>
  `;
}

function renderOperationLogItem(item) {
  const ok = item.status === "success";
  const cancelled = item.status === "cancelled";
  const label = t(ok ? "成功" : cancelled ? "已取消" : "失败");
  const duration = formatDurationText(item.durationMs);
  const summary = t(String(item.summary || (ok ? "操作已完成" : cancelled ? "操作已取消" : "操作失败")).trim());
  const output = String(item.outputTail || "").trim();
  const detail = output && output !== summary ? `${summary}\n\n${output}` : summary;
  const command = item.command || item.action || "";
  return tt`
    <article class="operation-log-item ${ok ? "success" : cancelled ? "cancelled" : "error"}">
      <div class="operation-log-head">
        <span class="log-status">${label}</span>
        <strong title="${escapeAttr(t(item.label || ""))}">${escapeHtml(t(item.label || "Git 操作"))}</strong>
        <em>${escapeHtml(duration)}</em>
      </div>
      <div class="operation-log-meta">
        <span>${escapeHtml(item.time || "")}</span>
        <code title="${escapeAttr(command)}">${escapeHtml(command)}</code>
      </div>
      <pre>${escapeHtml(detail)}</pre>
    </article>
  `;
}

function formatDurationText(ms) {
  const value = Math.max(0, Number(ms) || 0);
  if (value < 1000) return `${Math.round(value)}ms`;
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  return `${Math.round(seconds / 60)}min`;
}

async function refreshLogsTab() {
  if (!state.data) return;
  const repoPath = repoPathSnapshot();
  await api("/api/operations");
  if (!isCurrentRepoPath(repoPath)) return;
  renderInspector();
}
