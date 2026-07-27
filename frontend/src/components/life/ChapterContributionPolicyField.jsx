export default function ChapterContributionPolicyField({ value, onChange, disabled = false, error }) {
  return (
    <fieldset className="chapter-policy-field" aria-describedby="chapter-policy-help">
      <legend>谁可以投稿</legend>
      <p id="chapter-policy-help">两种合集都可以被所有人浏览；这里仅控制谁能投稿。</p>
      <div className="chapter-policy-field__options">
        <label className={value === 'public' ? 'is-selected' : ''}>
          <input type="radio" name="contribution_policy" value="public" checked={value === 'public'} disabled={disabled} onChange={() => onChange('public')} />
          <span><strong>开放投稿</strong><small>所有符合发布条件的登录用户都可以向这个合集投稿。</small></span>
        </label>
        <label className={value === 'private' ? 'is-selected' : ''}>
          <input type="radio" name="contribution_policy" value="private" checked={value === 'private'} disabled={disabled} onChange={() => onChange('private')} />
          <span><strong>仅自己投稿</strong><small>所有人都可以浏览，但只有你可以向这个合集投稿。</small></span>
        </label>
      </div>
      {error && <p className="form-feedback form-feedback--error">{error}</p>}
    </fieldset>
  )
}
