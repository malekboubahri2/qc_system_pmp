#include <gui/summary_screen/summaryView.hpp>
#include <texts/TextKeysAndLanguages.hpp>
#include <touchgfx/Color.hpp>
#include <touchgfx/Unicode.hpp>

summaryView::summaryView()
    : m_tickCount(0)
{
    m_countBuf[0] = 0;
    m_nameBuf[0]  = 0;

    /* "Taux des défauts" — 0xE9 = é */
    static const touchgfx::Unicode::UnicodeChar LABEL[] = {
        'T','a','u','x',' ','d','e','s',' ','d',0xE9,'f','a','u','t','s',0
    };
    size_t i = 0;
    while (LABEL[i] && i < LABEL_BUF_SIZE - 1) { m_labelBuf[i] = LABEL[i]; ++i; }
    m_labelBuf[i] = 0;

    /* Big defect count in the centre. */
    m_countDisplay.setTypedText(touchgfx::TypedText(T_SUMMARY_LARGE));
    m_countDisplay.setWildcard(m_countBuf);
    m_countDisplay.setColor(touchgfx::Color::getColorFromRGB(255, 255, 255));
    m_countDisplay.setPosition(0, 155, 272, 70);
    add(m_countDisplay);

    /* "Taux des défauts" label below the count. */
    m_labelDisplay.setTypedText(touchgfx::TypedText(T_SUMMARY_NORMAL));
    m_labelDisplay.setWildcard(m_labelBuf);
    m_labelDisplay.setColor(touchgfx::Color::getColorFromRGB(180, 200, 230));
    m_labelDisplay.setPosition(10, 235, 252, 25);
    add(m_labelDisplay);

    /* Operator name. */
    m_nameDisplay.setTypedText(touchgfx::TypedText(T_SUMMARY_NORMAL));
    m_nameDisplay.setWildcard(m_nameBuf);
    m_nameDisplay.setColor(touchgfx::Color::getColorFromRGB(160, 190, 220));
    m_nameDisplay.setPosition(10, 295, 252, 25);
    add(m_nameDisplay);
}

void summaryView::setupScreen()
{
    summaryViewBase::setupScreen(); /* transitionBegins() overridden → no immediate nav */

    m_tickCount = 0;

    __background.setColor(touchgfx::Color::getColorFromRGB(20, 40, 80));
    __background.invalidate();
}

void summaryView::tearDownScreen()
{
    summaryViewBase::tearDownScreen();
}

void summaryView::setDisplayData(int defectCount, const char* operatorName)
{
    touchgfx::Unicode::snprintf(m_countBuf, COUNT_BUF_SIZE, "%d", defectCount);

    size_t i = 0;
    while (operatorName[i] && i < NAME_BUF_SIZE - 1)
    {
        m_nameBuf[i] = static_cast<touchgfx::Unicode::UnicodeChar>(
            static_cast<unsigned char>(operatorName[i]));
        ++i;
    }
    m_nameBuf[i] = 0;

    m_countDisplay.invalidate();
    m_nameDisplay.invalidate();
}

void summaryView::handleTickEvent()
{
    if (++m_tickCount >= 240) /* 4 s at 60 fps */
    {
        application().gotologinScreenNoTransition();
    }
}
