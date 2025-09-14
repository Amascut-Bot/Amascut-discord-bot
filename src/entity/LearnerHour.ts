import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm"
import { LearnerHourParticipation } from "./LearnerHourParticipation";

@Entity()
export class LearnerHour {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    host: string

    @Column({ nullable: true })
    link: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date;

    @OneToMany(type => LearnerHourParticipation, participant => participant.learnerHour) participants: LearnerHourParticipation[];
}
