import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm"
import { LearnerHour } from "./LearnerHour";

@Entity()
export class LearnerHourParticipation {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    participant: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date;

    @ManyToOne(type => LearnerHour, learnerHour => learnerHour.participants) learnerHour: LearnerHour;
}
