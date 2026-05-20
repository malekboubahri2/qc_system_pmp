#include <gui/login_screen/loginView.hpp>
#include <gui/common/FrontendApplication.hpp>

static const touchgfx::colortype COLOR_DOT   = touchgfx::Color::getColorFromRGB(0xD4, 0xB7, 0x65);
static const touchgfx::colortype COLOR_ERROR = touchgfx::Color::getColorFromRGB(0xE5, 0x3E, 0x3E);

loginView::loginView()
    : m_keyCallback(this, &loginView::onKeyClicked),
      m_error_ticks(0)
{
}

void loginView::setupScreen()
{
    loginViewBase::setupScreen();

    keypad_1.setClickAction(m_keyCallback);
    keypad_2.setClickAction(m_keyCallback);
    keypad_3.setClickAction(m_keyCallback);
    keypad_4.setClickAction(m_keyCallback);
    keypad_5.setClickAction(m_keyCallback);
    keypad_6.setClickAction(m_keyCallback);
    keypad_7.setClickAction(m_keyCallback);
    keypad_8.setClickAction(m_keyCallback);
    keypad_9.setClickAction(m_keyCallback);

    setDigitCount(0);
}

void loginView::tearDownScreen()
{
    loginViewBase::tearDownScreen();
}

void loginView::handleTickEvent()
{
    if (m_error_ticks > 0)
    {
        --m_error_ticks;
        if (m_error_ticks == 0)
            setDigitCount(0);
    }
}

void loginView::setDigitCount(int n)
{
    m_error_ticks = 0;

    touchgfx::Circle*        circles[4]  = { &PIN_1, &PIN_2, &PIN_3, &PIN_4 };
    touchgfx::PainterRGB888* painters[4] = {
        &PIN_1Painter, &PIN_2Painter, &PIN_3Painter, &PIN_4Painter
    };

    for (int i = 0; i < 4; ++i)
    {
        painters[i]->setColor(COLOR_DOT);
        circles[i]->setPainter(*painters[i]);
        /* lineWidth 0 = filled disc; lineWidth 2 = outline ring */
        circles[i]->setLineWidth(i < n ? 0 : 2);
        circles[i]->invalidate();
    }
}

void loginView::showError()
{
    touchgfx::Circle*        circles[4]  = { &PIN_1, &PIN_2, &PIN_3, &PIN_4 };
    touchgfx::PainterRGB888* painters[4] = {
        &PIN_1Painter, &PIN_2Painter, &PIN_3Painter, &PIN_4Painter
    };

    for (int i = 0; i < 4; ++i)
    {
        painters[i]->setColor(COLOR_ERROR);
        circles[i]->setPainter(*painters[i]);
        circles[i]->setLineWidth(0); // filled
        circles[i]->invalidate();
    }

    m_error_ticks = 36; // ~600 ms at 60 fps
}

void loginView::gotoProductRefScreen()
{
    application().gotoproductRefScreenNoTransition();
}

void loginView::onKeyClicked(const KeypadButton& src, const touchgfx::ClickEvent& evt)
{
    if (evt.getType() != touchgfx::ClickEvent::RELEASED)
        return;

    int digit = 0;
    if      (&src == static_cast<const KeypadButton*>(&keypad_1)) digit = 1;
    else if (&src == static_cast<const KeypadButton*>(&keypad_2)) digit = 2;
    else if (&src == static_cast<const KeypadButton*>(&keypad_3)) digit = 3;
    else if (&src == static_cast<const KeypadButton*>(&keypad_4)) digit = 4;
    else if (&src == static_cast<const KeypadButton*>(&keypad_5)) digit = 5;
    else if (&src == static_cast<const KeypadButton*>(&keypad_6)) digit = 6;
    else if (&src == static_cast<const KeypadButton*>(&keypad_7)) digit = 7;
    else if (&src == static_cast<const KeypadButton*>(&keypad_8)) digit = 8;
    else if (&src == static_cast<const KeypadButton*>(&keypad_9)) digit = 9;

    if (digit > 0)
        presenter->digitPressed(digit);
}
