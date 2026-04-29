import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class ReportBlacklist {

    @PrimaryGeneratedColumn()
    id: number

    @Column({ unique: true })
    userId: string

    @Column()
    addedBy: string

    @Column({ type: 'text', nullable: true })
    reason: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date
}