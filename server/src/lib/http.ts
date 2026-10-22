import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

export class HttpError extends Error {
  issues: { path: string; message: string }[]

  constructor(status: number, message: string, issues: { path: string; message: string }[] = []) {
    super(message)
    this.status = status
    this.issues = issues
  }

  status: number
}

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw new HttpError(
      400,
      'Check the highlighted fields.',
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || 'form',
        message: issue.message,
      })),
    )
  }
  return result.data
}

export function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next)
  }
}

export function isUniqueViolation(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes('duplicate key')
}

export function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) return forwarded.split(',')[0]!.trim()
  return req.ip || ''
}
