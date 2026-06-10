import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class TrialReport {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    reporter: string

    @Column()
    reportedUser: string

    @Column()
    rsn: string

    @Column()
    role: string

    @Column({ type: 'text' })
    description: string

    @Column({ nullable: true })
    ticketChannelId: string

    @Column({ nullable: true })
    ticketRole: string

    @Column({ default: 'pending' })
    status: string

    @Column({ type: 'text', nullable: true })
    messageId: string | null

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date
}