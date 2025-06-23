import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm"
import { ReaperParticipation } from "./ReaperParticipation"

@Entity()
export class Reaper {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    recipient: string

    @Column()
    host: string

    @Column({ nullable: true })
    link: string

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToMany(type => ReaperParticipation, participant => participant.reaper) participants: ReaperParticipation[];
}
