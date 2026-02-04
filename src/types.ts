export interface QuestionOption {
    no: number;
    content: string;
}

export interface Question {
    id: number;
    no: number;
    content: string;
    form_type: number; // 1:单选, 2:多选, 3:文本
    is_required: boolean;
    mst_menu_id: number | null;
    options: QuestionOption[];
}

export interface QuestionPage {
    id: number;
    display_title: string;
    mst_questions: Question[];
}

export interface Answer {
    mst_question_id: number;
    mst_menu_id: number | null;
    answered_option_no: number | string;
}

export interface Comment {
    mst_question_id: number;
    mst_menu_id: number | null;
    answered_text: string;
}