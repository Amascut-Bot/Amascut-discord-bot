import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class ReportVote {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    reportId: number

    @Column()
    voterId: string

    @Column()
    vote: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date
}