import { query, queryOne } from "@/lib/db";
import type { InternalMessage } from "@/types";

export async function listInbox(userId: string): Promise<InternalMessage[]> {
  return query<InternalMessage>(
    `SELECT im.*, u.name AS sender_name, u.email AS sender_email
     FROM internal_messages im
     JOIN users u ON u.id = im.sender_id
     WHERE im.recipient_id = $1
     ORDER BY im.created_at DESC`,
    [userId]
  );
}

export async function listSent(userId: string): Promise<InternalMessage[]> {
  return query<InternalMessage>(
    `SELECT im.*, u.name AS recipient_name, u.email AS recipient_email
     FROM internal_messages im
     JOIN users u ON u.id = im.recipient_id
     WHERE im.sender_id = $1
     ORDER BY im.created_at DESC`,
    [userId]
  );
}

export async function countUnread(userId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `SELECT COUNT(*) FROM internal_messages WHERE recipient_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return Number(row?.count ?? 0);
}

export async function getMessageForUser(
  messageId: string,
  userId: string
): Promise<InternalMessage | null> {
  const message = await queryOne<InternalMessage>(
    `SELECT im.*,
            su.name AS sender_name, su.email AS sender_email,
            ru.name AS recipient_name, ru.email AS recipient_email
     FROM internal_messages im
     JOIN users su ON su.id = im.sender_id
     JOIN users ru ON ru.id = im.recipient_id
     WHERE im.id = $1 AND (im.sender_id = $2 OR im.recipient_id = $2)`,
    [messageId, userId]
  );
  if (!message) return null;

  if (message.recipient_id === userId && !message.read_at) {
    await queryOne(
      `UPDATE internal_messages SET read_at = now() WHERE id = $1 RETURNING id`,
      [messageId]
    );
    message.read_at = new Date().toISOString();
  }

  return message;
}

export async function listRecipientOptions(
  excludeUserId: string
): Promise<{ id: string; name: string; email: string; role: string }[]> {
  return query(
    `SELECT id, name, email, role FROM users
     WHERE id != $1 AND active
     ORDER BY name ASC`,
    [excludeUserId]
  );
}

export interface SendMessageInput {
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  attachmentUrl?: string;
  parentMessageId?: string;
  isForward?: boolean;
}

export async function sendMessage(input: SendMessageInput): Promise<InternalMessage> {
  const message = await queryOne<InternalMessage>(
    `INSERT INTO internal_messages
       (sender_id, recipient_id, subject, body, attachment_url, parent_message_id, is_forward)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.senderId,
      input.recipientId,
      input.subject,
      input.body,
      input.attachmentUrl ?? null,
      input.parentMessageId ?? null,
      input.isForward ?? false,
    ]
  );
  if (!message) throw new Error("Falha ao enviar mensagem.");
  return message;
}
