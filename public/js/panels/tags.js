// Tag panel and actions.
function renderTagsTab() {
  const tags = state.data?.tags || [];
  if (state.selectedTag && !tags.some((tag) => tag.name === state.selectedTag)) {
    state.selectedTag = "";
  }
  if (!state.selectedTag && tags.length) state.selectedTag = tags[0].name;
  const selected = tags.find((tag) => tag.name === state.selectedTag);
  els.detailNode.style.borderColor = "var(--blue)";
  els.detailTitle.textContent = t("标签列表");
  els.detailSub.textContent = tags.length ? t("{count} 个 Tag", { count: tags.length }) : t("没有 Tag");
  setActiveDiff(null);
  if (!tags.length) {
    els.detailBody.innerHTML = tt`
      <div class="empty-panel">
        <strong>没有 Tag</strong>
        <span>在提交右键菜单中选择“创建 Tag”后会显示在这里。</span>
      </div>
    `;
    return;
  }
  els.detailBody.innerHTML = tt`
    <div class="tag-layout">
      <div class="tag-list">
        ${tags.map((tag) => tagRowHtml(tag, tag.name === state.selectedTag)).join("")}
      </div>
      <div class="tag-detail">
        ${selected ? tagDetailHtml(selected) : ""}
      </div>
    </div>
  `;
}

function tagRowHtml(tag, active) {
  return `
    <button class="tag-row ${active ? "active" : ""}" data-tag-name="${escapeAttr(tag.name)}" type="button">
      <span class="stash-row-top">
        <strong>${escapeHtml(tag.name)}</strong>
        <em>${escapeHtml(tag.time || "")}</em>
      </span>
      <span class="stash-message" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || t("无说明"))}</span>
      <span class="stash-branch">${escapeHtml(tag.short || tag.object ? `${tag.short || tag.object} · ${tag.type || "commit"}` : tag.type || "commit")}</span>
    </button>
  `;
}

function tagDetailHtml(tag) {
  return tt`
    <div class="tag-actions">
      <button class="mini-btn" data-tag-action="view" data-tag-name="${escapeAttr(tag.name)}" type="button">查看提交</button>
      <button class="mini-btn" data-tag-action="copy" data-tag-name="${escapeAttr(tag.name)}" type="button">复制名称</button>
      <button class="mini-btn" data-tag-action="push" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> refs/tags/${escapeAttr(tag.name)}:refs/tags/${escapeAttr(tag.name)}">推送 Tag</button>
      <button class="mini-btn danger" data-tag-action="deleteLocal" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git tag -d ${escapeAttr(tag.name)}">删除本地</button>
      <button class="mini-btn danger" data-tag-action="deleteRemote" data-tag-name="${escapeAttr(tag.name)}" type="button" title="git push <远端> :refs/tags/${escapeAttr(tag.name)}">删除远端</button>
    </div>
    <div class="meta-grid stash-meta">
      <span>名称</span><div class="meta-value">${escapeHtml(tag.name)}</div>
      <span>对象</span><div class="meta-value">${escapeHtml(tag.short || tag.object || t("未知"))}</div>
      <span>类型</span><div class="meta-value">${escapeHtml(tag.type || "commit")}</div>
      <span>时间</span><div class="meta-value">${escapeHtml(tag.time || t("未知"))}</div>
      <span>说明</span><div class="meta-value" title="${escapeAttr(tag.subject || "")}">${escapeHtml(tag.subject || t("无说明"))}</div>
    </div>
    <div class="empty-panel compact">
      <span>推送 Tag 会把这个本地标签发布到远端；删除远端 Tag 不会删除本地 Tag。</span>
    </div>
  `;
}

function selectTag(name) {
  if (!name || name === state.selectedTag) return;
  state.selectedTag = name;
  renderInspector();
}

async function runTagAction(action, tagName, button) {
  if (!state.data || !tagName) return;
  const tag = (state.data.tags || []).find((item) => item.name === tagName) || { name: tagName };
  if (action === "view") {
    state.selectedTab = "details";
    await selectRef(tag.name);
    return;
  }
  if (action === "copy") {
    await copyText(tag.name);
    toast(t("已复制 Tag 名称"));
    return;
  }
  const remote = action === "push" || action === "deleteRemote" ? defaultTagRemote() : null;
  if ((action === "push" || action === "deleteRemote") && !remote?.name) {
    toast(t("当前仓库没有远端。请先添加远端仓库后再操作 Tag。"));
    return;
  }
  const message = tagActionConfirmMessage(action, tag.name, remote?.name);
  if (!state.data.repo.isSample && !confirm(message)) return;
  const actionMap = {
    push: "pushTag",
    deleteLocal: "deleteTag",
    deleteRemote: "deleteRemoteTag",
  };
  const repoPath = repoPathSnapshot();
  try {
    if (button) button.disabled = true;
    const payload = { action: actionMap[action], name: tag.name, sha: tag.object || "" };
    if (remote?.name) Object.assign(payload, { remote: remote.name }, remoteConfigSnapshotPayload(remote));
    const result = await api("/api/action", { method: "POST", body: JSON.stringify(payload) });
    if (!isCurrentRepoPath(repoPath)) return;
    toast(result.output || t("Tag 操作完成"));
    const data = await loadStateForRepoPath(repoPath);
    if (!data) return;
    state.commitDetails.clear();
    state.data = data;
    state.selectedRef = state.data.repo.selectedRef || state.selectedRef;
    if (!state.data.tags?.some((item) => item.name === state.selectedTag)) {
      state.selectedTag = state.data.tags?.[0]?.name || "";
    }
    renderAll();
    if (state.selectedSha && state.selectedTab !== "tags") {
      await renderSelectedCommitForRepoPath(repoPath);
    }
  } catch (error) {
    if (!isCurrentRepoPath(repoPath)) return;
    toast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

function defaultTagRemote() {
  const remotes = syncRemotes();
  return remotes.find((remote) => remote.name === "origin") || remotes[0] || null;
}

function tagActionConfirmMessage(action, name, remoteName = "<远端>") {
  const remote = remoteName === "<远端>" ? t("<远端>") : remoteName;
  if (action === "push") return t("确认推送 Tag：{name}？\n\n命令：git push {remote} refs/tags/{name}:refs/tags/{name}", { name, remote });
  if (action === "deleteLocal") return t("确认删除本地 Tag：{name}？\n\n命令：git tag -d {name}\n此操作不会删除远端 Tag。", { name });
  if (action === "deleteRemote") return t("确认删除远端 Tag：{name}？\n\n命令：git push {remote} :refs/tags/{name}\n此操作不会删除本地 Tag。", { name, remote });
  return t("确认操作 Tag：{name}？", { name });
}
