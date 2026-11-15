// Какая беседа сейчас открыта в окне: по ней уведомления решают, нужен ли тост «врач ответил».
// Если беседа открыта, сообщение и так видно на экране, и всплывать ничего не должно
let openId = null;

export const setOpenConversation = (id) => { openId = id; };
export const isConversationOpen = (id) => openId === id;
