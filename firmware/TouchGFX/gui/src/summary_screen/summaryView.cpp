#include <gui/summary_screen/summaryView.hpp>
#include <gui/common/pmp_colors.hpp>
#include <texts/TextKeysAndLanguages.hpp>
#include <touchgfx/Color.hpp>
#include <touchgfx/Unicode.hpp>

summaryView::summaryView()
    : m_signoutCb(this, &summaryView::onSignoutClicked),
      m_nextPieceCb(this, &summaryView::onNextPieceClicked),
      m_changeProductCb(this, &summaryView::onChangeProductClicked)
{
    m_countBuf[0] = 0;
    m_nameBuf[0]  = 0;

    m_countDisplay.setTypedText(touchgfx::TypedText(T_SUMMARY_LARGE));
    m_countDisplay.setWildcard(m_countBuf);
    m_countDisplay.setColor(touchgfx::Color::getColorFromRGB(255, 255, 255));
    m_countDisplay.setPosition(0, 155, 272, 70);
    add(m_countDisplay);

    m_rateLabel.setTypedText(touchgfx::TypedText(T_SUMMARY_RATE_LABEL));
    m_rateLabel.setColor(touchgfx::Color::getColorFromRGB(180, 200, 230));
    m_rateLabel.setPosition(10, 235, 252, 22);
    add(m_rateLabel);

    m_nameDisplay.setTypedText(touchgfx::TypedText(T_SUMMARY_NORMAL));
    m_nameDisplay.setWildcard(m_nameBuf);
    m_nameDisplay.setColor(touchgfx::Color::getColorFromRGB(160, 190, 220));
    m_nameDisplay.setPosition(10, 262, 252, 22);
    add(m_nameDisplay);

    m_signoutBtn.setText(touchgfx::TypedText(T_SUMMARY_BTN_SIGNOUT));
    m_signoutBtn.setBoxWithBorderColors(
        pmp::colors::brand_teal(), pmp::colors::dark_pressed(),
        pmp::colors::accent_gold(), pmp::colors::accent_gold());
    m_signoutBtn.setTextColors(pmp::colors::cream(), pmp::colors::cream());
    m_signoutBtn.setPosition(10, 298, 252, 50);
    m_signoutBtn.setClickAction(m_signoutCb);
    add(m_signoutBtn);

    m_nextPieceBtn.setText(touchgfx::TypedText(T_SUMMARY_BTN_NEXT));
    m_nextPieceBtn.setBoxWithBorderColors(
        pmp::colors::success_green(), pmp::colors::dark_pressed(),
        pmp::colors::cream(), pmp::colors::cream());
    m_nextPieceBtn.setTextColors(pmp::colors::cream(), pmp::colors::cream());
    m_nextPieceBtn.setPosition(10, 355, 252, 50);
    m_nextPieceBtn.setClickAction(m_nextPieceCb);
    add(m_nextPieceBtn);

    m_changeProductBtn.setText(touchgfx::TypedText(T_SUMMARY_BTN_CHANGE));
    m_changeProductBtn.setBoxWithBorderColors(
        pmp::colors::brand_teal(), pmp::colors::dark_pressed(),
        pmp::colors::accent_gold(), pmp::colors::accent_gold());
    m_changeProductBtn.setTextColors(pmp::colors::cream(), pmp::colors::cream());
    m_changeProductBtn.setPosition(10, 412, 252, 50);
    m_changeProductBtn.setClickAction(m_changeProductCb);
    add(m_changeProductBtn);
}

void summaryView::setupScreen()
{
    summaryViewBase::setupScreen();

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

void summaryView::onSignoutClicked(const NavBtnBase& /*src*/, const touchgfx::ClickEvent& evt)
{
    if (evt.getType() != touchgfx::ClickEvent::RELEASED)
        return;
    application().gotologinScreenNoTransition();
}

void summaryView::onNextPieceClicked(const NavBtnBase& /*src*/, const touchgfx::ClickEvent& evt)
{
    if (evt.getType() != touchgfx::ClickEvent::RELEASED)
        return;
    application().gotodefects_injScreenNoTransition();
}

void summaryView::onChangeProductClicked(const NavBtnBase& /*src*/, const touchgfx::ClickEvent& evt)
{
    if (evt.getType() != touchgfx::ClickEvent::RELEASED)
        return;
    application().gotoproductRefScreenNoTransition();
}
