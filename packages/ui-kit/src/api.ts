// HTTP client dùng chung (fetch): gắn Bearer, unwrap envelope {success,data,meta},
// 401 CÓ token → thử refresh 1 lần rồi retry; onTrace để Debug Console ghi log.
// CHỈ file trong services/ của app được import createApi (rule FE §3).

export interface ApiTrace {
  method: string; path: string; url: string; status: number; ms: number; ok: boolean; ts: string
  requestBody?: unknown; response?: unknown; error?: string
}

export interface CreateApiOptions {
  baseURL: string
  getToken?: () => string | null
  onUnauthorized?: () => void          // 401 CÓ token (hết phiên thật) → logout
  onRefresh?: () => Promise<string | null>  // làm mới access token; null = thất bại
  onTrace?: (t: ApiTrace) => void
}

export interface ApiError extends Error { code: string; status: number; data?: unknown }

export interface ListMeta { page: number; pageSize: number; total: number; totalPages: number }

export interface Api {
  get<T = any>(path: string, params?: Record<string, any>): Promise<T>
  /** GET danh sách phân trang — giữ nguyên meta của envelope: trả {rows, meta}. */
  getList<T = any>(path: string, params?: Record<string, any>): Promise<{ rows: T[]; meta: ListMeta }>
  post<T = any>(path: string, body?: any): Promise<T>
  postForm<T = any>(path: string, form: FormData): Promise<T>
  /** GET nhị phân (PDF/ảnh…) → Blob. Gắn Bearer + refresh 1 lần như request thường; KHÔNG unwrap envelope. */
  getBlob(path: string, params?: Record<string, any>): Promise<Blob>
  patch<T = any>(path: string, body?: any): Promise<T>
  put<T = any>(path: string, body?: any): Promise<T>
  del<T = any>(path: string, body?: any): Promise<T>
  attachmentContentUrl(id: string): string
}

export function createApi(opts: CreateApiOptions): Api {
  const base = opts.baseURL.replace(/\/$/, '')

  function qs(params?: Record<string, any>): string {
    if (!params) return ''
    const s = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) s.append(k, String(v)) })
    const str = s.toString()
    return str ? '?' + str : ''
  }

  async function request<T>(method: string, path: string, o: { body?: any; form?: FormData; params?: Record<string, any>; withMeta?: boolean } = {}, isRetry = false): Promise<T> {
    const url = base + path + qs(o.params)
    const headers: Record<string, string> = {}
    const token = opts.getToken?.()
    if (token) headers['Authorization'] = 'Bearer ' + token
    let bodyInit: BodyInit | undefined
    if (o.form) { bodyInit = o.form }
    else if (o.body !== undefined) { headers['Content-Type'] = 'application/json'; bodyInit = JSON.stringify(o.body) }

    const ts = new Date().toISOString()
    const t0 = performance.now()
    const res = await fetch(url, { method, headers, body: bodyInit, credentials: 'include' })
    const ms = Math.round(performance.now() - t0)

    // 401 CÓ token → thử refresh 1 lần (lần retry sẽ tự ghi trace của nó)
    if (res.status === 401 && token && !isRetry && opts.onRefresh) {
      const newToken = await opts.onRefresh()
      if (newToken) return request<T>(method, path, o, true)
      opts.onUnauthorized?.()
    } else if (res.status === 401 && token) {
      opts.onUnauthorized?.()
    }

    let json: any = null
    try { json = await res.json() } catch { /* no body */ }

    const isErr = !res.ok || (json && json.success === false)
    // Debug Console: ghi MỌI lời gọi (không kèm Authorization header)
    opts.onTrace?.({
      method, path, url, status: res.status, ms, ok: res.ok, ts,
      requestBody: o.form ? '[form-data]' : o.body,
      response: json,
      error: isErr ? (json?.error?.message ?? res.statusText) : undefined,
    })

    if (isErr) {
      const err = new Error(json?.error?.message ?? res.statusText) as ApiError
      err.code = json?.error?.code ?? String(res.status)
      err.status = res.status
      err.data = json
      throw err
    }
    if (o.withMeta) return { rows: json?.data ?? [], meta: json?.meta ?? null } as T
    return (json ? json.data : null) as T
  }

  async function requestBlob(path: string, params?: Record<string, any>, isRetry = false): Promise<Blob> {
    const url = base + path + qs(params)
    const headers: Record<string, string> = {}
    const token = opts.getToken?.()
    if (token) headers['Authorization'] = 'Bearer ' + token
    const ts = new Date().toISOString(); const t0 = performance.now()
    const res = await fetch(url, { method: 'GET', headers, credentials: 'include' })
    const ms = Math.round(performance.now() - t0)

    if (res.status === 401 && token && !isRetry && opts.onRefresh) {
      const newToken = await opts.onRefresh()
      if (newToken) return requestBlob(path, params, true)
      opts.onUnauthorized?.()
    } else if (res.status === 401 && token) {
      opts.onUnauthorized?.()
    }
    opts.onTrace?.({ method: 'GET', path, url, status: res.status, ms, ok: res.ok, ts, response: '[binary]' })
    if (!res.ok) {
      let msg = res.statusText
      try { const j = await res.json(); msg = j?.error?.message ?? msg } catch { /* không phải JSON */ }
      const err = new Error(msg) as ApiError
      err.code = String(res.status); err.status = res.status
      throw err
    }
    return res.blob()
  }

  return {
    get: (p, params) => request('GET', p, { params }),
    getList: (p, params) => request('GET', p, { params, withMeta: true }),
    getBlob: (p, params) => requestBlob(p, params),
    post: (p, body) => request('POST', p, { body }),
    postForm: (p, form) => request('POST', p, { form }),
    patch: (p, body) => request('PATCH', p, { body }),
    put: (p, body) => request('PUT', p, { body }),
    del: (p, body) => request('DELETE', p, { body }),
    attachmentContentUrl: (id: string) => `${base}/attachments/${id}/content`,
  }
}
