import{useCallback,useEffect,useRef,useState}from"react";import{Link,useParams}from"react-router-dom";import*as admin from"../api/admin.js";import{createGame,createGameHero,createGameMap,updateGame,updateGameHero,updateGameMap}from"../api/games.js";import{deleteUnboundImage}from"../api/uploads.js";import{useAuth}from"../auth/useAuth.js";import AdminActionDialog from"../components/admin/AdminActionDialog.jsx";import ImageUploadField from"../components/upload/ImageUploadField.jsx";function useLoad(loader,deps=[]){const ref=useRef(loader);const key=deps.join("|");const[state,setState]=useState({loading:true,data:null,error:null});useEffect(()=>{ref.current=loader},[loader]);const load=useCallback(()=>{setState({loading:true,data:null,error:null});ref.current().then(data=>setState({loading:false,data,error:null})).catch(error=>setState({loading:false,data:null,error}))},[]);useEffect(()=>{load()},[load,key]);return[state,load]}function State({state,children}){if(state.loading)return<p className="state-message">正在加载…</p>;if(state.error)return<p className="state-message state-message--error">
        {state.error.message}
      </p>;return children}function useDialog(){const[dialog,setDialog]=useState(null);return[dialog,setDialog]}const reasonField={name:"reason",label:"\u64CD\u4F5C\u539F\u56E0",type:"textarea",required:true};const resolutionField={name:"resolution_message",label:"\u5BF9\u4E3E\u62A5\u8005\u53EF\u89C1\u7684\u5904\u7406\u8BF4\u660E",type:"textarea",required:true};const noteField={name:"internal_note",label:"\u5185\u90E8\u5907\u6CE8\uFF08\u4E0D\u4F1A\u901A\u77E5\u7528\u6237\uFF09",type:"textarea"};function AdminDashboardPage(){const[state]=useLoad(admin.getAdminSummary);const labels=[["\u5F85\u5904\u7406\u4E3E\u62A5","pending_report_count"],["\u5904\u7406\u4E2D\u4E3E\u62A5","in_progress_report_count"],["\u5F85\u5BA1\u6838\u7AE0\u8282","pending_chapter_count"],["\u5DF2\u4E0B\u67B6\u65E5\u5E38","hidden_life_post_count"],["\u5DF2\u4E0B\u67B6\u6559\u6750","hidden_guide_count"],["\u6D3B\u8DC3\u7528\u6237","active_user_count"],["\u4ECA\u65E5\u4E3E\u62A5","today_report_count"],["\u4ECA\u65E5\u7BA1\u7406\u64CD\u4F5C","today_admin_action_count"]];return<State state={state}>
      {state.data&&<section className="admin-page">
          <h2>后台概览</h2>
          <div className="admin-stats">
            {labels.map(([label,key])=><div key={key}>
                <strong>{state.data[key]}</strong>
                <span>{label}</span>
              </div>)}
          </div>
        </section>}
    </State>}function AdminReportsPage(){const[state,load]=useLoad(()=>admin.getAdminReports({page_size:50}));return<State state={state}>
      {state.data&&<section className="admin-page">
          <h2>举报管理</h2>
          <button onClick={load}>刷新</button>
          <div className="admin-list">
            {state.data.data.map(item=><Link key={item.id}to={`/admin/reports/${item.id}`}>
                <strong>
                  #{item.id} · {item.target_type}
                </strong>
                <span>
                  {item.reason} · {item.status}
                </span>
                <small>
                  {new Date(item.created_at).toLocaleString("zh-CN")}
                </small>
              </Link>)}
          </div>
        </section>}
    </State>}function AdminReportDetailPage(){const{id}=useParams();const[state,load]=useLoad(()=>admin.getAdminReport(id),[id]);const[dialog,setDialog]=useDialog();const simple=async operation=>{await operation();load()};const submit=async values=>{if(dialog.action==="reject")await admin.rejectReport(id,values);else await admin.resolveReport(id,{action:dialog.action,...values});load()};return<State state={state}>
      {state.data&&<section className="admin-page">
          <h2>举报 #{state.data.id}</h2>
          <p>
            {state.data.reason} · {state.data.status}
          </p>
          <p>{state.data.description||"\u65E0\u8865\u5145\u8BF4\u660E"}</p>
          <pre>{JSON.stringify(state.data.target_snapshot,null,2)}</pre>
          <div className="admin-actions">
            {state.data.status==="pending"&&<button onClick={()=>void simple(()=>admin.claimReport(id))}>
                领取
              </button>}
            {state.data.status==="in_progress"&&<button onClick={()=>void simple(()=>admin.releaseReport(id))}>
                释放
              </button>}
            {state.data.allowed_actions?.map(action=><button key={action}onClick={()=>setDialog({action,title:`\u5904\u7406\u4E3E\u62A5\uFF1A${action}`})}>
                {action}
              </button>)}
            <button className="button--danger"onClick={()=>setDialog({action:"reject",title:"\u9A73\u56DE\u4E3E\u62A5"})}>
              驳回举报
            </button>
          </div>
          <AdminActionDialog open={Boolean(dialog)}title={dialog?.title}description="处理说明会发送给举报者；内部备注仅供后台查看。"fields={[resolutionField,noteField,...["delete_content","ban_user"].includes(dialog?.action)?[{name:"confirmation",label:`\u8F93\u5165 ${dialog.action==="ban_user"?"BAN":"DELETE"} \u786E\u8BA4\u64CD\u4F5C`,required:true}]:[]]}dangerous={dialog?.action==="reject"||["delete_content","ban_user"].includes(dialog?.action)}submitLabel="提交处理"onClose={()=>setDialog(null)}onSubmit={submit}/>
        </section>}
    </State>}function AdminUsersPage(){const[query,setQuery]=useState("");const[role,setRole]=useState("");const[status,setStatus]=useState("");const[state,load]=useLoad(()=>admin.getAdminUsers({page_size:50,query,role,status}),[query,role,status]);return<section className="admin-page">
      <h2>用户管理</h2>
      <form className="admin-filters"onSubmit={event=>{event.preventDefault();load()}}>
        <input value={query}onChange={event=>setQuery(event.target.value)}placeholder="搜索用户名、昵称或邮箱"/>
        <select value={role}onChange={event=>setRole(event.target.value)}>
          <option value="">全部角色</option>
          <option value="user">普通用户</option>
          <option value="content_admin">内容管理员</option>
          <option value="system_admin">系统管理员</option>
        </select>
        <select value={status}onChange={event=>setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="active">正常</option>
          <option value="banned">封禁</option>
        </select>
        <button>筛选</button>
      </form>
      <State state={state}>
        {state.data&&<div className="admin-list">
            {state.data.data.map(item=><Link key={item.id}to={`/admin/users/${item.id}`}>
                <strong>
                  {item.nickname} @{item.username}
                </strong>
                <span>
                  {item.role} · {item.status}
                </span>
                <small>
                  发布：{item.can_publish?"\u5141\u8BB8":"\u9650\u5236"} / 评论：
                  {item.can_comment?"\u5141\u8BB8":"\u9650\u5236"}
                </small>
              </Link>)}
          </div>}
      </State>
    </section>}function AdminUserDetailPage(){const{id}=useParams();const{user}=useAuth();const[state,load]=useLoad(()=>admin.getAdminUser(id),[id]);const[dialog,setDialog]=useDialog();const submit=async values=>{const{kind,payload}=dialog;if(kind==="restrictions")await admin.updateUserRestrictions(id,{...payload,reason:values.reason});if(kind==="status")await admin.updateUserStatus(id,{...payload,reason:values.reason,...payload.status==="banned"?{confirmation:values.confirm_text}:{}});if(kind==="role")await admin.updateUserRole(id,{role:values.role,reason:values.reason});load()};return<State state={state}>
      {state.data&&<section className="admin-page">
          <h2>
            {state.data.nickname} @{state.data.username}
          </h2>
          <p>
            {state.data.email} · {state.data.role} · {state.data.status}
          </p>
          <div className="admin-actions">
            <button disabled={!state.data.can_manage}onClick={()=>setDialog({kind:"restrictions",title:state.data.can_publish?"\u9650\u5236\u53D1\u5E03":"\u89E3\u9664\u53D1\u5E03\u9650\u5236",payload:{can_publish:!state.data.can_publish}})}>
              {state.data.can_publish?"\u9650\u5236\u53D1\u5E03":"\u89E3\u9664\u53D1\u5E03\u9650\u5236"}
            </button>
            <button disabled={!state.data.can_manage}onClick={()=>setDialog({kind:"restrictions",title:state.data.can_comment?"\u7981\u6B62\u8BC4\u8BBA":"\u89E3\u9664\u7981\u6B62\u8BC4\u8BBA",payload:{can_comment:!state.data.can_comment}})}>
              {state.data.can_comment?"\u7981\u6B62\u8BC4\u8BBA":"\u89E3\u9664\u7981\u6B62\u8BC4\u8BBA"}
            </button>
            {user.role==="system_admin"&&<>
                <button className="button--danger"disabled={!state.data.can_manage}onClick={()=>setDialog({kind:"status",title:state.data.status==="banned"?"\u89E3\u9664\u5C01\u7981":"\u5C01\u7981\u8D26\u53F7",dangerous:state.data.status!=="banned",payload:{status:state.data.status==="banned"?"active":"banned"}})}>
                  {state.data.status==="banned"?"\u89E3\u9664\u5C01\u7981":"\u5C01\u7981\u8D26\u53F7"}
                </button>
                <button disabled={!state.data.can_manage}onClick={()=>setDialog({kind:"role",title:"\u4FEE\u6539\u7528\u6237\u89D2\u8272",payload:{}})}>
                  修改角色
                </button>
              </>}
          </div>
          <AdminActionDialog open={Boolean(dialog)}title={dialog?.title}dangerous={dialog?.dangerous}description="该操作会被写入管理员日志。"fields={dialog?.kind==="role"?[{name:"role",label:"\u65B0\u89D2\u8272",type:"select",required:true,value:state.data.role,options:[{value:"user",label:"\u666E\u901A\u7528\u6237"},{value:"content_admin",label:"\u5185\u5BB9\u7BA1\u7406\u5458"},{value:"system_admin",label:"\u7CFB\u7EDF\u7BA1\u7406\u5458"}]},reasonField,...dialog?.dangerous?[{name:"confirm_text",label:"\u8F93\u5165 BAN \u786E\u8BA4\u5C01\u7981",required:true}]:[]]:[reasonField,...dialog?.dangerous?[{name:"confirm_text",label:"\u8F93\u5165 BAN \u786E\u8BA4\u5C01\u7981",required:true}]:[]]}submitLabel="保存"onClose={()=>setDialog(null)}onSubmit={async values=>{if(dialog?.dangerous&&values.confirm_text!=="BAN")throw new Error("\u786E\u8BA4\u8BCD\u4E0D\u5339\u914D\u3002");await submit(values)}}/>
        </section>}
    </State>}function AdminContentPage(){const[tab,setTab]=useState("life");const[query,setQuery]=useState("");const[status,setStatus]=useState("");const loader=tab==="life"?admin.getAdminLifePosts:tab==="guide"?admin.getAdminGuides:tab==="comment"?admin.getAdminComments:null;const[state,load]=useLoad(()=>tab==="featured"?admin.getAdminFeatured():loader({page_size:50,query,status}),[tab,query,status]);const[dialog,setDialog]=useDialog();const execute=async values=>{const{item,kind}=dialog;const type=tab==="life"?"life_post":"game_guide";if(kind==="hide")await admin.hideContent(type,item.id,{reason:values.reason});if(kind==="delete"){const payload={reason:values.reason,confirmation:values.confirm_text};if(tab==="comment")await admin.deleteAdminComment(item.id,payload);else await admin.deleteAdminContent(type,item.id,payload)}if(kind==="invalid")await admin.markGuideInvalid(item.id);if(kind==="comment-hide")await admin.hideComment(item.id);load()};const quick=async(item,kind)=>{const type=tab==="life"?"life_post":"game_guide";if(kind==="restore")await admin.restoreContent(type,item.id);if(kind==="feature")await admin.featureContent(type,item.id,{});if(kind==="unfeature")await admin.unfeatureContent(item.target_type,item.target_id);if(kind==="comment-restore")await admin.restoreComment(item.id);load()};const items=state.data?.data||state.data||[];return<section className="admin-page">
      <h2>内容管理</h2>
      <div className="account-tabs">
        {[["life","\u65E5\u5E38"],["guide","\u6559\u6750"],["comment","\u8BC4\u8BBA"],["featured","\u7F16\u8F91\u7CBE\u9009"]].map(([key,label])=><button key={key}aria-pressed={tab===key}onClick={()=>setTab(key)}>
            {label}
          </button>)}
      </div>
      {tab!=="featured"&&<form className="admin-filters"onSubmit={event=>{event.preventDefault();load()}}>
          <input value={query}onChange={event=>setQuery(event.target.value)}placeholder="搜索标题或评论"/>
          <select value={status}onChange={event=>setStatus(event.target.value)}>
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="hidden">已下架/隐藏</option>
            <option value="active">正常评论</option>
            <option value="deleted">已删除评论</option>
          </select>
          <button>筛选</button>
        </form>}
      <State state={state}>
        <div className="admin-list">
          {items.map(item=><article key={item.id||`${item.target_type}-${item.target_id}`}>
              <strong>
                {item.title||item.content?.title||item.body||`\u8BC4\u8BBA #${item.id}`}
              </strong>
              <span>
                {item.status||item.content?.status||item.target_type}
              </span>
              <div className="admin-actions">
                {tab==="comment"?<>
                    {item.status==="active"&&<button onClick={()=>setDialog({item,kind:"comment-hide",title:"\u9690\u85CF\u8BC4\u8BBA"})}>
                        隐藏
                      </button>}
                    {item.status==="hidden"&&<button onClick={()=>void quick(item,"comment-restore")}>
                        恢复
                      </button>}
                    {item.status!=="deleted"&&<button className="button--danger"onClick={()=>setDialog({item,kind:"delete",title:"\u6C38\u4E45\u5220\u9664\u8BC4\u8BBA",dangerous:true})}>
                        删除
                      </button>}
                  </>:tab==="featured"?<button onClick={()=>void quick(item,"unfeature")}>
                    取消精选
                  </button>:<>
                    {item.status==="published"?<>
                        <button onClick={()=>setDialog({item,kind:"hide",title:"\u4E0B\u67B6\u5185\u5BB9"})}>
                          下架
                        </button>
                        <button onClick={()=>void quick(item,"feature")}>
                          精选
                        </button>
                      </>:<button onClick={()=>void quick(item,"restore")}>
                        恢复
                      </button>}
                    {tab==="guide"&&<button onClick={()=>setDialog({item,kind:"invalid",title:"\u6807\u8BB0\u6559\u6750\u5931\u6548"})}>
                        标记失效
                      </button>}
                    <button className="button--danger"onClick={()=>setDialog({item,kind:"delete",title:"\u6C38\u4E45\u5220\u9664\u5185\u5BB9",dangerous:true})}>
                      永久删除
                    </button>
                  </>}
              </div>
            </article>)}
        </div>
      </State>
      <AdminActionDialog open={Boolean(dialog)}title={dialog?.title}dangerous={dialog?.dangerous}fields={[...dialog?.kind==="hide"||dialog?.dangerous?[reasonField]:[],...dialog?.dangerous?[{name:"confirm_text",label:"\u8F93\u5165 DELETE \u786E\u8BA4\u5220\u9664",required:true}]:[]]}submitLabel="确认"onClose={()=>setDialog(null)}onSubmit={async values=>{if(dialog?.dangerous&&values.confirm_text!=="DELETE")throw new Error("\u786E\u8BA4\u8BCD\u4E0D\u5339\u914D\u3002");await execute(values)}}/>
    </section>}function AdminChaptersPage(){const[filter,setFilter]=useState("pending");const[state,load]=useLoad(()=>admin.getAdminChapters({page_size:50,...filter==="disabled"?{status:"disabled"}:filter==="merged"?{status:"merged"}:{review_status:filter}}),[filter]);const[dialog,setDialog]=useDialog();const submit=async values=>{const{item,type}=dialog;if(type==="reject")await admin.rejectChapter(item.id,{review_note:values.resolution_message});if(type==="edit")await admin.updateAdminChapter(item.id,{name:values.name,aliases:values.aliases.split(",").map(value=>value.trim()).filter(Boolean)});if(type==="merge")await admin.mergeChapter(item.id,{target_chapter_id:Number(values.target_chapter_id),reason:values.reason});load()};const quick=async(item,type)=>{if(type==="approve")await admin.approveChapter(item.id,{});if(type==="disable")await admin.disableChapter(item.id);if(type==="enable")await admin.enableChapter(item.id);load()};return<section className="admin-page">
      <h2>章节管理</h2>
      <div className="account-tabs">
        {[["pending","\u5F85\u5BA1\u6838"],["approved","\u5DF2\u901A\u8FC7"],["rejected","\u5DF2\u9A73\u56DE"],["disabled","\u5DF2\u7981\u7528"],["merged","\u5DF2\u5408\u5E76"]].map(([key,label])=><button key={key}aria-pressed={filter===key}onClick={()=>setFilter(key)}>
            {label}
          </button>)}
      </div>
      <State state={state}>
        {state.data&&<div className="admin-list">
            {state.data.data.map(item=><article key={item.id}>
                <strong>{item.name}</strong>
                <span>
                  {item.review_status} · {item.status}
                </span>
                <small>{item.review_note||"\u6682\u65E0\u5BA1\u6838\u610F\u89C1"}</small>
                <div className="admin-actions">
                  {item.review_status==="pending"&&<>
                      <button onClick={()=>void quick(item,"approve")}>
                        通过
                      </button>
                      <button onClick={()=>setDialog({item,type:"reject",title:"\u9A73\u56DE\u7AE0\u8282"})}>
                        驳回
                      </button>
                    </>}
                  {item.status==="active"&&<button onClick={()=>void quick(item,"disable")}>
                      禁用
                    </button>}
                  {item.status==="disabled"&&<button onClick={()=>void quick(item,"enable")}>
                      启用
                    </button>}
                  <button onClick={()=>setDialog({item,type:"edit",title:"\u7F16\u8F91\u7AE0\u8282"})}>
                    编辑
                  </button>
                  {item.status==="active"&&<button className="button--danger"onClick={()=>setDialog({item,type:"merge",title:"\u5408\u5E76\u7AE0\u8282",dangerous:true})}>
                      合并
                    </button>}
                </div>
              </article>)}
          </div>}
      </State>
      <AdminActionDialog open={Boolean(dialog)}title={dialog?.title}dangerous={dialog?.dangerous}fields={dialog?.type==="reject"?[resolutionField]:dialog?.type==="edit"?[{name:"name",label:"\u7AE0\u8282\u540D\u79F0",required:true,value:dialog.item.name},{name:"aliases",label:"\u522B\u540D\uFF08\u9017\u53F7\u5206\u9694\uFF09",value:(dialog.item.aliases||[]).join(",")}]:[{name:"target_chapter_id",label:"\u76EE\u6807\u7AE0\u8282 ID",type:"number",required:true},reasonField,{name:"confirm_text",label:"\u8F93\u5165 MERGE \u786E\u8BA4\u8FC1\u79FB",required:true}]}submitLabel="保存"onClose={()=>setDialog(null)}onSubmit={async values=>{if(dialog?.type==="merge"&&values.confirm_text!=="MERGE")throw new Error("\u786E\u8BA4\u8BCD\u4E0D\u5339\u914D\u3002");await submit(values)}}/>
    </section>}function CatalogEditor({tab,item,onClose,onSaved}){const[form,setForm]=useState(()=>({name_zh:item?.name_zh||"",name_en:item?.name_en||"",aliases:(item?.aliases||[]).join(","),game_id:item?.game?.id||"",icon_media_id:void 0,cover_media_id:void 0,avatar_media_id:void 0}));const uploaded=useRef(new Map);const[saving,setSaving]=useState(false);const[error,setError]=useState(null);useEffect(()=>()=>{uploaded.current.forEach(publicId=>{void deleteUnboundImage(publicId).catch(()=>{})})},[]);const image=(label,url,key)=><ImageUploadField key={key}label={label}purpose="content"currentImageUrl={form[`${key}_url`]??(form[key]===void 0?url:null)}disabled={saving}onUploaded={async media=>{if(form[key]&&uploaded.current.has(form[key])){await deleteUnboundImage(uploaded.current.get(form[key])).catch(()=>{});uploaded.current.delete(form[key])}uploaded.current.set(media.id,media.public_id);setForm(current=>({...current,[key]:media.id,[`${key}_url`]:media.thumbnail_url}))}}onRemove={async()=>{if(form[key]&&uploaded.current.has(form[key])){await deleteUnboundImage(uploaded.current.get(form[key]));uploaded.current.delete(form[key])}setForm(current=>({...current,[key]:null,[`${key}_url`]:null}))}}/>;const save=async event=>{event.preventDefault();setSaving(true);setError(null);const base={name_zh:form.name_zh,name_en:form.name_en||null,aliases:form.aliases.split(",").map(value=>value.trim()).filter(Boolean)};if(tab==="games"){const payload={...base,...form.icon_media_id!==void 0?{icon_media_id:form.icon_media_id}:{},...form.cover_media_id!==void 0?{cover_media_id:form.cover_media_id}:{}};item?await updateGame(item.id,payload):await createGame(payload)}else{const gameId=Number(form.game_id);if(!gameId)throw new Error("\u8BF7\u586B\u5199\u6240\u5C5E\u6E38\u620F ID\u3002");const imageKey=tab==="heroes"?"avatar_media_id":"cover_media_id";const payload={...base,...form[imageKey]!==void 0?{[imageKey]:form[imageKey]}:{}};if(tab==="heroes")item?await updateGameHero(gameId,item.id,payload):await createGameHero(gameId,payload);else item?await updateGameMap(gameId,item.id,payload):await createGameMap(gameId,payload)}uploaded.current.clear();onSaved()};return<form className="catalog-editor"onSubmit={event=>void save(event).catch(requestError=>{setError(requestError.message);setSaving(false)})}>
      <h3>
        {item?"\u7F16\u8F91":"\u65B0\u5EFA"}
        {tab==="games"?"\u6E38\u620F":tab==="heroes"?"\u82F1\u96C4":"\u5730\u56FE"}
      </h3>
      <label>
        中文名
        <input required value={form.name_zh}onChange={event=>setForm(current=>({...current,name_zh:event.target.value}))}/>
      </label>
      <label>
        英文名
        <input value={form.name_en}onChange={event=>setForm(current=>({...current,name_en:event.target.value}))}/>
      </label>
      <label>
        别名（逗号分隔）
        <input value={form.aliases}onChange={event=>setForm(current=>({...current,aliases:event.target.value}))}/>
      </label>
      {tab!=="games"&&<label>
          所属游戏 ID
          <input required type="number"value={form.game_id}onChange={event=>setForm(current=>({...current,game_id:event.target.value}))}/>
        </label>}
      {tab==="games"&&<div className="catalog-editor__images">
          {image("\u6E38\u620F\u56FE\u6807",item?.icon_thumbnail_url||item?.icon_url,"icon_media_id")}
          {image("\u6E38\u620F\u5C01\u9762",item?.cover_thumbnail_url||item?.cover_url,"cover_media_id")}
        </div>}
      {tab==="heroes"&&image("\u82F1\u96C4\u5934\u50CF",item?.avatar_thumbnail_url||item?.avatar_url,"avatar_media_id")}
      {tab==="maps"&&image("\u5730\u56FE\u5C01\u9762",item?.cover_thumbnail_url||item?.cover_url,"cover_media_id")}
      {error&&<p className="form-feedback form-feedback--error">{error}</p>}
      <div className="admin-actions">
        <button type="button"onClick={onClose}disabled={saving}>
          取消
        </button>
        <button className="button button--primary"disabled={saving}>
          {saving?"\u4FDD\u5B58\u4E2D\u2026":"\u4FDD\u5B58"}
        </button>
      </div>
    </form>}function AdminCatalogPage(){const[tab,setTab]=useState("games");const[editing,setEditing]=useState(void 0);const loader=tab==="games"?admin.getAdminGames:tab==="heroes"?admin.getAdminHeroes:admin.getAdminMaps;const[state,reload]=useLoad(()=>loader({page_size:50}),[tab]);return<section className="admin-page">
      <h2>游戏目录</h2>
      <div className="account-tabs">
        {[["games","\u6E38\u620F"],["heroes","\u82F1\u96C4"],["maps","\u5730\u56FE"]].map(([key,label])=><button key={key}aria-pressed={tab===key}onClick={()=>{setTab(key);setEditing(void 0)}}>
            {label}
          </button>)}
      </div>
      <button className="button button--primary"onClick={()=>setEditing(null)}>
        新建{tab==="games"?"\u6E38\u620F":tab==="heroes"?"\u82F1\u96C4":"\u5730\u56FE"}
      </button>
      {editing!==void 0&&<CatalogEditor tab={tab}item={editing}onClose={()=>setEditing(void 0)}onSaved={()=>{setEditing(void 0);reload()}}/>}
      <State state={state}>
        {state.data&&<div className="admin-list">
            {state.data.data.map(item=><article key={item.id}>
                <strong>{item.name_zh}</strong>
                <span>
                  {item.status||item.current_status} ·{" "}
                  {item.review_status||"approved"}
                </span>
                <button onClick={()=>setEditing(item)}>编辑和图片</button>
              </article>)}
          </div>}
      </State>
    </section>}function AdminLogsPage(){const[action,setAction]=useState("");const[target,setTarget]=useState("");const[state,load]=useLoad(()=>admin.getAdminLogs({page_size:50,action,target_type:target}),[action,target]);const[selected,setSelected]=useState(null);return<section className="admin-page">
      <h2>管理员操作日志</h2>
      <form className="admin-filters"onSubmit={event=>{event.preventDefault();load()}}>
        <input value={action}onChange={event=>setAction(event.target.value)}placeholder="action"/>
        <input value={target}onChange={event=>setTarget(event.target.value)}placeholder="target_type"/>
        <button>筛选</button>
      </form>
      <State state={state}>
        {state.data&&<div className="admin-list">
            {state.data.data.map(item=><article key={item.id}>
                <strong>{item.action}</strong>
                <span>
                  {item.target_type} #{item.target_id||"\u2014"}
                </span>
                <small>{item.created_at}</small>
                <button onClick={()=>setSelected(item)}>查看详情</button>
              </article>)}
          </div>}
        {selected&&<section className="admin-log-detail">
            <h3>日志 #{selected.id}</h3>
            <pre>
              {JSON.stringify({before_data:selected.before_data,after_data:selected.after_data,metadata:selected.metadata},null,2)}
            </pre>
            <button onClick={()=>setSelected(null)}>关闭</button>
          </section>}
      </State>
    </section>}export{AdminCatalogPage,AdminChaptersPage,AdminContentPage,AdminDashboardPage,AdminLogsPage,AdminReportDetailPage,AdminReportsPage,AdminUserDetailPage,AdminUsersPage};
