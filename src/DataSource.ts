import "reflect-metadata"
import { DataSource } from "typeorm"
import { Override } from "./entity/Override"
import { Report } from "./entity/Report"
import { Trial } from "./entity/Trial"
import { TrialParticipation } from "./entity/TrialParticipation"
import { Reaper } from "./entity/Reaper"
import { ReaperParticipation } from "./entity/ReaperParticipation"
import { DpmSubmission } from "./entity/DpmSubmission"
import { KillTimeSubmission } from './entity/KillTimeSubmission'
import { Ticket } from "./entity/Ticket"
import { MessageShortcut } from "./entity/MessageShortcut"
import { EnrageLeaderboard } from "./entity/EnrageLeaderboard"
import { Warning } from "./entity/Warning"
import { Timeout } from "./entity/Timeout"
import { LearnerHour } from "./entity/LearnerHour"
import { LearnerHourParticipation } from "./entity/LearnerHourParticipation"
import { HostParticipation } from "./entity/HostParticipation"
import { Vouch } from "./entity/Vouch"
import { VouchBlacklist } from "./entity/VouchBlacklist"
import { VouchVote } from "./entity/VouchVote"
import { RoleAssignmentLog } from "./entity/RoleAssignmentLog"

export const AppDataSource = new DataSource({
    type: "sqlite",
    database: "db.sqlite",
    synchronize: true,
    logging: false,
    entities: [
        Reaper,
        ReaperParticipation,
        Trial,
        TrialParticipation,
        Report,
        Override,
        DpmSubmission,
        KillTimeSubmission,
        Ticket,
        MessageShortcut,
        EnrageLeaderboard,
        Warning,
        Timeout,
        LearnerHour,
        LearnerHourParticipation,
        HostParticipation,
        Vouch,
        VouchBlacklist,
        VouchVote,
        RoleAssignmentLog
    ],
    migrations: [],
    subscribers: [],
})
