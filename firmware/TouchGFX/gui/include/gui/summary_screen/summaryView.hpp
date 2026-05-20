#ifndef SUMMARYVIEW_HPP
#define SUMMARYVIEW_HPP

#include <gui_generated/summary_screen/summaryViewBase.hpp>
#include <gui/summary_screen/summaryPresenter.hpp>
#include <touchgfx/Callback.hpp>
#include <touchgfx/events/ClickEvent.hpp>
#include <touchgfx/containers/buttons/BoxWithBorderButtonStyle.hpp>
#include <touchgfx/containers/buttons/ClickButtonTrigger.hpp>
#include <touchgfx/containers/buttons/TextButtonStyle.hpp>
#include <touchgfx/mixins/ClickListener.hpp>
#include <touchgfx/widgets/TextArea.hpp>
#include <touchgfx/widgets/TextAreaWithWildcard.hpp>
#include <touchgfx/Unicode.hpp>
#include <stddef.h>

class summaryView : public summaryViewBase
{
public:
    summaryView();
    virtual ~summaryView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();

    virtual void transitionBegins() {}

    void setDisplayData(int defectCount, const char* operatorName);

private:
    typedef touchgfx::TextButtonStyle<
                touchgfx::BoxWithBorderButtonStyle<
                    touchgfx::ClickButtonTrigger>> NavBtnBase;
    typedef touchgfx::ClickListener<NavBtnBase> NavButton;

    static const size_t COUNT_BUF_SIZE = 16;
    static const size_t NAME_BUF_SIZE  = 32;

    touchgfx::Unicode::UnicodeChar m_countBuf[COUNT_BUF_SIZE];
    touchgfx::Unicode::UnicodeChar m_nameBuf[NAME_BUF_SIZE];

    touchgfx::TextAreaWithOneWildcard m_countDisplay;
    touchgfx::TextArea               m_rateLabel;
    touchgfx::TextAreaWithOneWildcard m_nameDisplay;

    NavButton m_signoutBtn;
    NavButton m_nextPieceBtn;
    NavButton m_changeProductBtn;

    void onSignoutClicked(const NavBtnBase& src, const touchgfx::ClickEvent& evt);
    void onNextPieceClicked(const NavBtnBase& src, const touchgfx::ClickEvent& evt);
    void onChangeProductClicked(const NavBtnBase& src, const touchgfx::ClickEvent& evt);

    touchgfx::Callback<summaryView, const NavBtnBase&, const touchgfx::ClickEvent&> m_signoutCb;
    touchgfx::Callback<summaryView, const NavBtnBase&, const touchgfx::ClickEvent&> m_nextPieceCb;
    touchgfx::Callback<summaryView, const NavBtnBase&, const touchgfx::ClickEvent&> m_changeProductCb;
};

#endif // SUMMARYVIEW_HPP
