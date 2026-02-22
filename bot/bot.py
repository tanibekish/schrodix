from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton
import asyncio

# Токен получишь у @BotFather
TOKEN = "токен"
# Ссылка на твой фронтенд (пока можно поставить любую, например google.com)
APP_URL = "https://your-mini-app-url.com"

bot = Bot(token=TOKEN)
dp = Dispatcher()

@dp.message(Command("start"))
async def start_handler(message: types.Message):
    # Вытаскиваем аргумент из команды /start (если он есть)
    args = message.text.split()
    ref_id = args[1] if len(args) > 1 and args[1].isdigit() else None

    # Формируем ссылку для Mini App с пробросом ref_id
    app_url = f"https://твой-нгрок-фронтенд.app"
    if ref_id:
        app_url += f"?ref={ref_id}"

    markup = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Играть 🚀", web_app=WebAppInfo(url=app_url))]
    ])
    
    await message.answer("Добро пожаловать в Prediction Market!", reply_markup=markup)

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())