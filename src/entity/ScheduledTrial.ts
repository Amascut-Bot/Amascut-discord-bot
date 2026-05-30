import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm"

@Entity()
export class ScheduledTrial {
    @PrimaryGeneratedColumn()
    id: number

    @Column()
    guildId: string

    @Column()
    channelId: string

    @Column({ type: 'text', nullable: true })
    messageId: string | null

    @Column()
    hostId: string

    // Trial tier role key (e.g. "grandmaster2000")
    @Column()
    tier: string

    @Column({ type: 'datetime' })
    scheduledTime: Date

    @Column({ type: 'int', default: 1 })
    minTrialees: number

    @Column({ type: 'int' })
    maxTrialees: number

    // Signed-up trialee user IDs
    @Column({ type: 'simple-json' })
    trialees: string[]

    // Signed-up trial-team fill user IDs
    @Column({ type: 'simple-json', nullable: true })
    fills: string[]

    @Column({ type: 'text', nullable: true })
    message: string | null

    @Column({ default: false })
    reminderSent: boolean

    // scheduled | completed | cancelled
    @Column({ default: 'scheduled' })
    status: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date
}
