// Running and completed Git operation logs.
function renderLogsTab() {
  const logs = state.data?.operationLog || [];
  const running = state.data?.runningOperations || [];
  els.detailTitle.textContent = t("操作日志");
  els.detailSub.textContent = running.length
    ? t("{count} 个 Git 操作正在执行", { count: running.length })
    : logs.length
      ? t("最近 {count} 条 Git 操作", { count: logs.length })
      : t("还没有执行过 Git 操作");
  els.detailNode.style.borderColor = running.length || logs.some((item) => item.status === "error") ? "var(--amber)" : "var(--teal)";
  setActiveDiff(null);
  els.detailBody.innerHTML = tt`
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

async function cancelRunningOperation(id, options = {}) {
  let operation = (state.data?.runningOperations || []).find((item) => String(item.id) === String(id));
  if (!operation) {
    await refreshOperationProgress();
    operation = (state.data?.runningOperations || []).find((item) => String(item.id) === String(id));
  }
  if (!operation) throw new Error(t("这个 Git 操作已经结束，请刷新操作日志查看结果。"));
  if (!operation.cancellable && !operation.cancelRequested) throw new Error(t("这个 Git 操作当前不能取消。"));
  if (operation.cancelRequested) return;
  if (options.confirm !== false) {
    const command = operation.command ? `\n\n${operation.command}` : "";
    if (!confirm(t("确认取消“{label}”？{command}\n\nGit 会停止当前命令，已经完成的远端传输不会自动回退。", { label: t(operation.label || "Git 操作"), command }))) return;
  }
  if (options.button) options.button.disabled = true;
  const result = await api("/api/operations/cancel", {
    method: "POST",
    body: JSON.stringify({ id: operation.id }),
  });
  renderOperationProgressIfVisible();
  toast(result.output || t("正在取消操作"));
  return result;
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
