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
        Ticket
    ],
    migrations: [],
    subscribers: [],
})
