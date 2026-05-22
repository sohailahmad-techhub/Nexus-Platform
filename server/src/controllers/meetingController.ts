import { Response } from 'express';
import Meeting from '../models/Meeting';
import User from '../models/User';
import { AuthRequest } from '../middleware/authMiddleware';

export const scheduleMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const hostId = req.user?.id;
    const { inviteeId, title, description, startTime, endTime } = req.body;

    if (!hostId || !inviteeId || !title || !startTime || !endTime) {
      return res.status(400).json({ error: 'Invitee ID, title, start time and end time are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start >= end) {
      return res.status(400).json({ error: 'Start time must be before end time' });
    }

    if (start < new Date()) {
      return res.status(400).json({ error: 'Cannot schedule meetings in the past' });
    }

    // Verify invitee exists
    const invitee = await User.findById(inviteeId);
    if (!invitee) {
      return res.status(404).json({ error: 'Invitee not found' });
    }

    // Conflict detection: check if host or invitee has an overlapping accepted meeting
    const overlappingMeetings = await Meeting.find({
      $or: [
        { hostId },
        { inviteeId: hostId },
        { hostId: inviteeId },
        { inviteeId }
      ],
      status: 'accepted',
      $and: [
        { startTime: { $lt: end } },
        { endTime: { $gt: start } }
      ]
    });

    if (overlappingMeetings.length > 0) {
      return res.status(400).json({
        error: 'Double booking conflict detected. Either you or the invitee has an overlapping accepted meeting in this time range.'
      });
    }

    const meeting = new Meeting({
      hostId,
      inviteeId,
      title,
      description,
      startTime: start,
      endTime: end,
      status: 'pending'
    });

    await meeting.save();
    return res.status(201).json(meeting);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const getMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const meetings = await Meeting.find({
      $or: [
        { hostId: userId },
        { inviteeId: userId }
      ]
    })
      .populate('hostId', 'name email avatarUrl role')
      .populate('inviteeId', 'name email avatarUrl role')
      .sort({ startTime: 1 });

    return res.status(200).json(meetings);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const acceptMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Only the invitee can accept the meeting
    if (meeting.inviteeId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the invitee can accept the meeting request' });
    }

    // Verify no conflict before accepting
    const start = meeting.startTime;
    const end = meeting.endTime;

    const overlappingMeetings = await Meeting.find({
      _id: { $ne: meeting._id },
      $or: [
        { hostId: meeting.hostId },
        { inviteeId: meeting.hostId },
        { hostId: meeting.inviteeId },
        { inviteeId: meeting.inviteeId }
      ],
      status: 'accepted',
      $and: [
        { startTime: { $lt: end } },
        { endTime: { $gt: start } }
      ]
    });

    if (overlappingMeetings.length > 0) {
      return res.status(400).json({
        error: 'Double booking conflict: Accepting this meeting would overlap with an already scheduled meeting for one of the participants.'
      });
    }

    meeting.status = 'accepted';
    await meeting.save();

    return res.status(200).json(meeting);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const rejectMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    // Check if the user is a participant
    if (meeting.inviteeId.toString() !== userId && meeting.hostId.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized to change meeting status' });
    }

    meeting.status = 'rejected';
    await meeting.save();

    return res.status(200).json(meeting);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const cancelMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const meeting = await Meeting.findById(id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    if (meeting.hostId.toString() !== userId && meeting.inviteeId.toString() !== userId) {
      return res.status(403).json({ error: 'Unauthorized to cancel meeting' });
    }

    meeting.status = 'canceled';
    await meeting.save();

    return res.status(200).json(meeting);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};
