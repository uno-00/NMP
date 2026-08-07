import mongoose from "mongoose";
import type { AuthUser } from "../middleware/auth.js";
import { Conversation } from "../models/Conversation.js";
import { ConversationMessage } from "../models/ConversationMessage.js";
import { Ticket } from "../models/Ticket.js";
import { User } from "../models/User.js";
import { emitConversationUpdate, emitNewMessage, refreshUserConversationRooms } from "../realtime/socket.js";
import { AppError } from "../utils/errors.js";

async function postTicketThreadSystemMessage(conversationId: string, body: string) {
  const message = await ConversationMessage.create({
    conversationId,
    senderId: new mongoose.Types.ObjectId("000000000000000000000000"),
    senderName: "System",
    senderRole: "admin",
    body,
    isSystem: true,
    mentions: [],
  });

  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: body.length > 120 ? `${body.slice(0, 117)}…` : body,
        lastSenderName: "System",
      },
    },
  );

  const serialized = {
    _id: message._id.toString(),
    conversationId,
    senderId: message.senderId.toString(),
    senderName: message.senderName,
    senderRole: message.senderRole,
    body: message.body,
    mentions: [] as Array<{ userId: string; userName: string }>,
    isSystem: true,
    createdAt: message.createdAt.toISOString(),
  };

  emitNewMessage({ conversationId, message: serialized });
  emitConversationUpdate({
    conversationId,
    lastMessageAt: message.createdAt.toISOString(),
    lastMessagePreview: body.length > 120 ? `${body.slice(0, 117)}…` : body,
    lastSenderName: "System",
  });
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

async function getActiveRecordsUserIds(): Promise<string[]> {
  const users = await User.find({ active: true, role: "record_management" })
    .select("_id")
    .lean();
  return users.map((u) => u._id.toString());
}

async function buildTicketParticipantIds(ticket: {
  creatorId: { toString(): string };
  assignedTo: Array<{ toString(): string }>;
}) {
  return uniqueIds([
    ticket.creatorId.toString(),
    ...ticket.assignedTo.map((id) => id.toString()),
    ...(await getActiveRecordsUserIds()),
  ]);
}

export async function ensureTicketConversation(ticketId: string) {
  let conv = await Conversation.findOne({ ticketId });
  if (conv) return conv;

  const ticket = await Ticket.findById(ticketId).lean();
  if (!ticket) throw new AppError(404, "Ticket not found");

  const participantIds = await buildTicketParticipantIds(ticket);

  conv = await Conversation.create({
    type: "ticket",
    ticketId: ticket._id,
    title: ticket.ticketNumber,
    participantIds,
  });

  return conv;
}

export async function syncTicketConversationParticipants(ticketId: string) {
  const ticket = await Ticket.findById(ticketId).lean();
  if (!ticket) return null;

  const conv = await ensureTicketConversation(ticketId);
  const nextParticipants = await buildTicketParticipantIds(ticket);

  const previous = new Set(conv.participantIds.map((id) => id.toString()));
  const added = nextParticipants.filter((id) => !previous.has(id));

  conv.participantIds = nextParticipants as never;
  conv.title = ticket.ticketNumber;
  await conv.save();

  const recordsIds = await getActiveRecordsUserIds();
  for (const userId of uniqueIds([...added, ...nextParticipants, ...recordsIds])) {
    await refreshUserConversationRooms(userId);
  }

  if (added.length > 0) {
    const assignedIdSet = new Set(ticket.assignedTo.map((id) => id.toString()));
    const addedAssigneeIds = added.filter((id) => assignedIdSet.has(id));
    if (addedAssigneeIds.length > 0) {
      const addedUsers = await User.find({ _id: { $in: addedAssigneeIds }, active: true })
        .select("name")
        .lean();
      if (addedUsers.length > 0) {
        await postTicketThreadSystemMessage(
          conv._id.toString(),
          `Assigned personnel added to this request thread: ${addedUsers.map((u) => u.name).join(", ")}`,
        );
      }
    }
  }

  return conv;
}

export async function setTicketConversationClosedState(ticketId: string, closed: boolean) {
  const conv = await Conversation.findOne({ ticketId });
  if (!conv) return null;

  conv.isClosed = closed;
  conv.closedAt = closed ? new Date() : null;
  await conv.save();

  if (closed) {
    await postTicketThreadSystemMessage(
      conv._id.toString(),
      "This request conversation was closed because the client closed the request.",
    );
  }

  const participantIds = conv.participantIds.map((id) => id.toString());
  const mentionableIds = await getTicketThreadMentionableUserIds(ticketId);
  for (const userId of uniqueIds([...participantIds, ...mentionableIds])) {
    await refreshUserConversationRooms(userId);
  }

  return conv;
}

export async function getTicketConversationForUser(user: AuthUser, ticketId: string) {
  await syncTicketConversationParticipants(ticketId);
  const conv = await Conversation.findOne({ ticketId }).lean();
  if (!conv) throw new AppError(404, "Conversation not found");
  if (conv.isClosed) throw new AppError(404, "Conversation is closed");

  const allowed = await canAccessTicketConversation(user, ticketId);
  if (!allowed) throw new AppError(403, "You do not have access to this request thread");

  return conv;
}

export async function getTicketThreadMentionableUserIds(ticketId: string): Promise<string[]> {
  const ticket = await Ticket.findById(ticketId).select("creatorId assignedTo").lean();
  if (!ticket) return [];

  return buildTicketParticipantIds(ticket);
}

export async function canAccessTicketConversation(
  user: AuthUser,
  ticketId: string,
) {
  const ticket = await Ticket.findById(ticketId).select("creatorId assignedTo").lean();
  if (!ticket) return false;

  if (user.role === "record_management") {
    return true;
  }

  if (ticket.creatorId.toString() === user.id) {
    return true;
  }

  return ticket.assignedTo.some((id) => id.toString() === user.id);
}
